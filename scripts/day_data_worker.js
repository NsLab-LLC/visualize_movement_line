"use strict";

importScripts("./filter_constants.js");

if (!self.MOVEMENT_FILTERS) {
    throw new Error("Movement filter constants are not loaded.");
}

const { WORK_LABEL_TO_CODE, LEVEL_LABEL_TO_CODE } = self.MOVEMENT_FILTERS;

const toInt16 = (value) => {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value > 32767) {
        return 32767;
    }
    if (value < -32768) {
        return -32768;
    }
    return Math.round(value);
};

const toUint16 = (value) => {
    if (!Number.isFinite(value) || value <= 0) {
        return 0;
    }
    if (value >= 65535) {
        return 65535;
    }
    return Math.round(value);
};

const fetchText = async (path) => {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }
    return response.text();
};

const parseAssignedArray = (sourceText) => {
    const assignIdx = sourceText.indexOf("=");
    if (assignIdx < 0) {
        throw new Error("Invalid data file format: '=' not found.");
    }
    let payload = sourceText.slice(assignIdx + 1).trim();
    if (payload.endsWith(";")) {
        payload = payload.slice(0, -1);
    }
    return JSON.parse(payload);
};

const addCode = (map, list, key) => {
    let code = map.get(key);
    if (code !== undefined) {
        return code;
    }
    code = list.length;
    map.set(key, code);
    list.push(key);
    return code;
};

const buildCompactDayData = (rows1, rows2, timeIndexLength) => {
    const counts = new Uint32Array(timeIndexLength);
    const deviceMap = new Map();
    const beaconMap = new Map();
    const deviceList = [];
    const beaconList = [];
    let rowCount = 0;

    const indexRows = (rows) => {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const idx = row.time_idx;
            if (!Number.isInteger(idx) || idx < 0 || idx >= timeIndexLength) {
                continue;
            }
            if (!(row.rssi > -120)) {
                continue;
            }
            if (WORK_LABEL_TO_CODE[row.work_time] === undefined) {
                continue;
            }
            if (LEVEL_LABEL_TO_CODE[row.level] === undefined) {
                continue;
            }
            counts[idx] += 1;
            rowCount += 1;
            addCode(deviceMap, deviceList, row.device);
            addCode(beaconMap, beaconList, row.beacon);
        }
    };

    indexRows(rows1);
    indexRows(rows2);

    const offsets = new Uint32Array(timeIndexLength + 1);
    for (let i = 0; i < timeIndexLength; i++) {
        offsets[i + 1] = offsets[i] + counts[i];
    }
    const cursor = offsets.slice(0, timeIndexLength);

    const deviceCodes = new Uint16Array(rowCount);
    const beaconCodes = new Uint16Array(rowCount);
    const levelCodes = new Uint8Array(rowCount);
    const workCodes = new Uint8Array(rowCount);
    const xValues = new Int16Array(rowCount);
    const yValues = new Int16Array(rowCount);
    const stayValues = new Uint16Array(rowCount);

    const fillRows = (rows) => {
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const idx = row.time_idx;
            if (!Number.isInteger(idx) || idx < 0 || idx >= timeIndexLength) {
                continue;
            }
            if (!(row.rssi > -120)) {
                continue;
            }
            const workCode = WORK_LABEL_TO_CODE[row.work_time];
            const levelCode = LEVEL_LABEL_TO_CODE[row.level];
            if (workCode === undefined || levelCode === undefined) {
                continue;
            }

            const writePos = cursor[idx]++;
            deviceCodes[writePos] = addCode(deviceMap, deviceList, row.device);
            beaconCodes[writePos] = addCode(beaconMap, beaconList, row.beacon);
            levelCodes[writePos] = levelCode;
            workCodes[writePos] = workCode;
            xValues[writePos] = toInt16(row.x);
            yValues[writePos] = toInt16(row.y);
            stayValues[writePos] = toUint16(row.stay_time);
        }
    };

    fillRows(rows1);
    fillRows(rows2);

    return {
        deviceList,
        beaconList,
        offsets,
        deviceCodes,
        beaconCodes,
        levelCodes,
        workCodes,
        xValues,
        yValues,
        stayValues,
    };
};

const loadDayData = async (ward, dateValue, timeIndexLength) => {
    const file1 = `./data/js/${ward}/${dateValue}_1.js`;
    const file2 = `./data/js/${ward}/${dateValue}_2.js`;
    const [text1, text2] = await Promise.all([fetchText(file1), fetchText(file2)]);
    const rows1 = parseAssignedArray(text1);
    const rows2 = parseAssignedArray(text2);
    if (!Array.isArray(rows1) || !Array.isArray(rows2)) {
        throw new Error(`Invalid data payload: ${dateValue}`);
    }
    return buildCompactDayData(rows1, rows2, timeIndexLength);
};

self.addEventListener("message", async (event) => {
    const message = event.data || {};
    if (message.type !== "load-day") {
        return;
    }
    const requestId = message.requestId;
    try {
        const ward = String(message.ward || "");
        const dateValue = String(message.dateValue || "");
        const timeIndexLength = Number(message.timeIndexLength);
        if (!Number.isInteger(timeIndexLength) || timeIndexLength <= 0) {
            throw new Error("Invalid time index length.");
        }
        const dayData = await loadDayData(ward, dateValue, timeIndexLength);
        self.postMessage(
            {
                type: "load-day-result",
                requestId,
                ok: true,
                dayData,
            },
            [
                dayData.offsets.buffer,
                dayData.deviceCodes.buffer,
                dayData.beaconCodes.buffer,
                dayData.levelCodes.buffer,
                dayData.workCodes.buffer,
                dayData.xValues.buffer,
                dayData.yValues.buffer,
                dayData.stayValues.buffer,
            ]
        );
    } catch (error) {
        self.postMessage({
            type: "load-day-result",
            requestId,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        });
    }
});
