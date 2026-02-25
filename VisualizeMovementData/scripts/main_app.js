"use strict";

const FILTERS = window.MOVEMENT_FILTERS;
if (!FILTERS) {
    throw new Error("Movement filter constants are not loaded.");
}

startVisualize().catch((error) => {
    console.error("[movement-line]", "initialization-failed", error);
    const loading = document.getElementById("loading");
    if (loading) {
        loading.classList.add("loaded");
    }
    const statusMessage = document.getElementById("status_message");
    if (statusMessage) {
        statusMessage.textContent = "初期化に失敗しました。設定ファイルを確認してください。";
        statusMessage.dataset.type = "error";
    }
});

async function startVisualize() {
    let ward = "";

    const loading = document.getElementById("loading");
    const selectDate = document.getElementById("date1");
    const timeSlider = document.getElementById("time_slider");
    const dateTimeLabel = document.getElementById("date_time_label");
    const statusMessage = document.getElementById("status_message");
    const workFilterControls = document.getElementById("work_filter_controls");
    const levelFilterControls = document.getElementById("level_filter_controls");
    const btnPrev30min = document.getElementById("btn_prev_30min");
    const btnRewind = document.getElementById("btn_rewind");
    const btnPause = document.getElementById("btn_pause");
    const btnPlay = document.getElementById("btn_play");
    const btnNext30min = document.getElementById("btn_next_30min");

    const TIME_INDEX_LENGTH = 26 * 60 * 60;
    const START_HOUR = 8;
    const DAY_BOUNDARY_INDEX = (24 - START_HOUR) * 60 * 60;
    const FPS = 10;
    const DATA_CACHE_LIMIT = 3;
    const CIRCLE_R = 20;
    const WIDTH_STAY_TIME = 50;
    const HEIGHT_STAY_TIME = 25;
    const LOG_PREFIX = "[movement-line]";
    const DATASET_CATALOG_PATH = "./data/dataset_catalog.json";
    const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
    const DEFAULT_DATASET_CONFIG = Object.freeze({
        ward: "test",
        dates: Object.freeze(["2023-03-15"]),
    });

    timeSlider.max = String(TIME_INDEX_LENGTH - 1);

    const stateDictionary = {
        level: {
            active: {
                未取得: "rgb(255, 0, 0, 1)",
                レベルⅠ: "rgb(0, 0, 255, 1)",
                レベルⅡ: "rgb(0, 128, 0, 1)",
                レベルⅢ: "rgb(128, 0, 128, 1)",
                レベルⅣ: "rgb(0, 0, 0, 1)",
            },
            inactive: {
                未取得: "rgb(255, 0, 0, 0.3)",
                レベルⅠ: "rgb(0, 0, 255, 0.3)",
                レベルⅡ: "rgb(0, 128, 0, 0.3)",
                レベルⅢ: "rgb(128, 0, 128, 0.3)",
                レベルⅣ: "rgb(0, 0, 0, 0.3)",
            },
            flag: {
                未取得: true,
                レベルⅠ: true,
                レベルⅡ: true,
                レベルⅢ: true,
                レベルⅣ: true,
            },
        },
        work: {
            active: {
                "12時間": "rgb(250,128,114, 1)",
                日勤: "rgb(255, 140, 0, 1)",
                夜勤: "rgb(100,149,237, 1)",
            },
            inactive: {
                "12時間": "rgb(250,128,114, 0.3)",
                日勤: "rgb(255, 140, 0, 0.3)",
                夜勤: "rgb(100,149,237, 0.3)",
            },
            flag: {
                "12時間": true,
                日勤: true,
                夜勤: true,
            },
        },
    };

    const STATION_LIST = ["beacon56", "beacon57", "beacon58"];
    const COLLIDOR_SET = new Set(Array.from({ length: 56 - 36 }, (_, i) => `beacon${i + 36}`));
    const BG_STAY_TIME = "rgb(255, 255, 255, 1)";
    const BG_STAY_TIME_CLEAR = "rgb(255, 255, 255, 0)";
    const BG_TEXT_STAY_TIME = "rgb(0, 0, 0, 1)";
    const BG_TEXT_STAY_TIME_CLEAR = "rgb(0, 0, 0, 0)";
    const { WORK_LABELS, LEVEL_LABELS, WORK_LABEL_TO_CODE, LEVEL_LABEL_TO_CODE } = FILTERS;

    const createEmptyDayData = () => ({
        deviceList: [],
        beaconList: [],
        offsets: new Uint32Array(TIME_INDEX_LENGTH + 1),
        deviceCodes: new Uint16Array(0),
        beaconCodes: new Uint16Array(0),
        levelCodes: new Uint8Array(0),
        workCodes: new Uint8Array(0),
        xValues: new Int16Array(0),
        yValues: new Int16Array(0),
        stayValues: new Uint16Array(0),
    });

    const logEvent = (level, eventName, details = {}) => {
        const logger = typeof console[level] === "function" ? console[level] : console.log;
        logger(LOG_PREFIX, eventName, details);
    };

    let statusTimerId = null;
    const showStatus = (message, type = "info", durationMs = 0) => {
        statusMessage.textContent = message;
        statusMessage.dataset.type = type;
        if (statusTimerId) {
            window.clearTimeout(statusTimerId);
            statusTimerId = null;
        }
        if (durationMs > 0) {
            statusTimerId = window.setTimeout(() => {
                statusMessage.textContent = "";
                statusMessage.dataset.type = "";
                statusTimerId = null;
            }, durationMs);
        }
    };

    const toDateList = (input) => {
        if (!Array.isArray(input)) {
            return [];
        }
        const dates = [];
        const seen = new Set();
        for (let i = 0; i < input.length; i++) {
            const dateValue = String(input[i]);
            if (!DATE_PATTERN.test(dateValue) || seen.has(dateValue)) {
                continue;
            }
            seen.add(dateValue);
            dates.push(dateValue);
        }
        return dates;
    };

    const normalizeDatasetConfig = (rawCatalog) => {
        if (!rawCatalog || typeof rawCatalog !== "object") {
            throw new Error("Dataset catalog must be an object.");
        }
        const wards = rawCatalog.wards;
        if (!wards || typeof wards !== "object") {
            throw new Error("Dataset catalog 'wards' is missing.");
        }
        const wardNames = Object.keys(wards);
        if (wardNames.length === 0) {
            throw new Error("Dataset catalog has no wards.");
        }

        const preferredWard =
            typeof rawCatalog.defaultWard === "string" ? rawCatalog.defaultWard : "";
        const candidates = preferredWard ? [preferredWard, ...wardNames] : wardNames;
        const visited = new Set();
        for (let i = 0; i < candidates.length; i++) {
            const wardName = candidates[i];
            if (visited.has(wardName)) {
                continue;
            }
            visited.add(wardName);
            const wardEntry = wards[wardName];
            if (!wardEntry || typeof wardEntry !== "object") {
                continue;
            }
            const dates = toDateList(wardEntry.dates);
            if (dates.length === 0) {
                continue;
            }
            return { ward: wardName, dates };
        }
        throw new Error("Dataset catalog has no valid ward/date set.");
    };

    const loadDatasetConfig = async () => {
        try {
            const response = await fetch(DATASET_CATALOG_PATH, { cache: "no-cache" });
            if (!response.ok) {
                throw new Error(`Failed to fetch dataset catalog: ${response.status}`);
            }
            const rawCatalog = await response.json();
            const config = normalizeDatasetConfig(rawCatalog);
            logEvent("info", "dataset-config-loaded", {
                ward: config.ward,
                dateCount: config.dates.length,
                path: DATASET_CATALOG_PATH,
            });
            return config;
        } catch (error) {
            logEvent("warn", "dataset-config-fallback", {
                path: DATASET_CATALOG_PATH,
                fallbackWard: DEFAULT_DATASET_CONFIG.ward,
                fallbackDateCount: DEFAULT_DATASET_CONFIG.dates.length,
                error: error instanceof Error ? error.message : String(error),
            });
            return DEFAULT_DATASET_CONFIG;
        }
    };

    const datasetConfig = await loadDatasetConfig();
    ward = datasetConfig.ward;
    selectDate.replaceChildren();
    for (let i = 0; i < datasetConfig.dates.length; i++) {
        const dateValue = datasetConfig.dates[i];
        selectDate.add(new Option(dateValue, dateValue));
    }

    let compactDayData = createEmptyDayData();
    let deviceList = [];
    let deviceStationPos = {};
    let activeDateLabel = "";
    let nextDateLabel = "";
    let timeIdx = 0;
    let timer = d3.timeout(() => {}, 1);
    let playLabel = "▶︎";
    let rewindLabel = "◀︎";
    let speedState = "stop";
    let playCount = 0;
    let rewindCount = 0;
    let dateSwitchToken = 0;
    let loadRequestId = 0;

    const dataCache = new Map();
    const pendingLoads = new Map();
    const deviceNodes = new Map();
    const visibleByDevice = new Map();
    const pendingWorkerRequests = new Map();
    const dayDataWorker = new Worker("./scripts/day_data_worker.js");
    let workFlagByCode = WORK_LABELS.map(() => true);
    let levelFlagByCode = LEVEL_LABELS.map(() => true);

    const workButtons = new Map();
    const levelButtons = new Map();

    const showLoading = () => loading.classList.remove("loaded");
    const hideLoading = () => loading.classList.add("loaded");
    const syncFilterCodeFlags = () => {
        workFlagByCode = WORK_LABELS.map((label) => Boolean(stateDictionary.work.flag[label]));
        levelFlagByCode = LEVEL_LABELS.map((label) => Boolean(stateDictionary.level.flag[label]));
    };
    syncFilterCodeFlags();

    function formatDate(date, format) {
        format = format.replace(/yyyy/g, date.getFullYear());
        format = format.replace(/MM/g, ("0" + (date.getMonth() + 1)).slice(-2));
        format = format.replace(/dd/g, ("0" + date.getDate()).slice(-2));
        format = format.replace(/HH/g, ("0" + date.getHours()).slice(-2));
        format = format.replace(/mm/g, ("0" + date.getMinutes()).slice(-2));
        format = format.replace(/ss/g, ("0" + date.getSeconds()).slice(-2));
        format = format.replace(/SSS/g, ("00" + date.getMilliseconds()).slice(-3));
        return format;
    }

    const toTimeLabel = (index) => {
        const sec = (index + START_HOUR * 60 * 60) % (24 * 60 * 60);
        const hh = Math.floor(sec / 3600);
        const mm = Math.floor((sec % 3600) / 60);
        const ss = sec % 60;
        return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
    };

    const toDateLabel = (index) => (index < DAY_BOUNDARY_INDEX ? activeDateLabel : nextDateLabel);
    const toDateTimeLabel = (index) => `${toDateLabel(index)} ${toTimeLabel(index)}`;

    const setDateContext = (dateValue) => {
        let dateDay = new Date(dateValue);
        let dateNight = new Date(dateValue);
        dateNight.setDate(dateNight.getDate() + 1);
        activeDateLabel = formatDate(dateDay, "yyyy-MM-dd");
        nextDateLabel = formatDate(dateNight, "yyyy-MM-dd");
    };

    const hydrateDayData = (workerDayData) => ({
        deviceList: workerDayData.deviceList || [],
        beaconList: workerDayData.beaconList || [],
        offsets: workerDayData.offsets || new Uint32Array(TIME_INDEX_LENGTH + 1),
        deviceCodes: workerDayData.deviceCodes || new Uint16Array(0),
        beaconCodes: workerDayData.beaconCodes || new Uint16Array(0),
        levelCodes: workerDayData.levelCodes || new Uint8Array(0),
        workCodes: workerDayData.workCodes || new Uint8Array(0),
        xValues: workerDayData.xValues || new Int16Array(0),
        yValues: workerDayData.yValues || new Int16Array(0),
        stayValues: workerDayData.stayValues || new Uint16Array(0),
    });

    dayDataWorker.addEventListener("message", (event) => {
        const message = event.data || {};
        if (message.type !== "load-day-result") {
            return;
        }
        const pending = pendingWorkerRequests.get(message.requestId);
        if (!pending) {
            logEvent("warn", "worker-response-without-pending-request", {
                requestId: message.requestId,
            });
            return;
        }
        pendingWorkerRequests.delete(message.requestId);
        const elapsedMs = Math.round(performance.now() - pending.requestAt);
        if (!message.ok) {
            const errorMessage = message.error || "Unknown worker error";
            logEvent("error", "worker-load-failed", {
                requestId: message.requestId,
                dateValue: pending.dateValue,
                elapsedMs,
                error: errorMessage,
            });
            pending.reject(
                new Error(
                    `[requestId=${message.requestId} date=${pending.dateValue}] ${errorMessage}`
                )
            );
            return;
        }
        logEvent("info", "worker-load-succeeded", {
            requestId: message.requestId,
            dateValue: pending.dateValue,
            elapsedMs,
        });
        pending.resolve(hydrateDayData(message.dayData || {}));
    });

    dayDataWorker.addEventListener("error", (event) => {
        const errorMessage = event.message || "Worker error";
        logEvent("error", "worker-runtime-error", {
            error: errorMessage,
        });
        for (const [requestId, pending] of pendingWorkerRequests.entries()) {
            pending.reject(
                new Error(
                    `[requestId=${requestId} date=${pending.dateValue}] ${errorMessage}`
                )
            );
        }
        pendingWorkerRequests.clear();
    });

    dayDataWorker.addEventListener("messageerror", (event) => {
        logEvent("error", "worker-messageerror", {
            dataType: typeof event.data,
        });
    });

    window.addEventListener("beforeunload", () => {
        dayDataWorker.terminate();
    });

    const requestDayData = (dateValue) =>
        new Promise((resolve, reject) => {
            const requestId = ++loadRequestId;
            pendingWorkerRequests.set(requestId, {
                resolve,
                reject,
                dateValue,
                requestAt: performance.now(),
            });
            logEvent("info", "worker-load-requested", {
                requestId,
                dateValue,
            });
            dayDataWorker.postMessage({
                type: "load-day",
                requestId,
                ward,
                dateValue,
                timeIndexLength: TIME_INDEX_LENGTH,
            });
        });

    const touchCache = (dateValue, value) => {
        if (dataCache.has(dateValue)) {
            dataCache.delete(dateValue);
        }
        dataCache.set(dateValue, value);
        while (dataCache.size > DATA_CACHE_LIMIT) {
            const oldestKey = dataCache.keys().next().value;
            dataCache.delete(oldestKey);
        }
    };

    const loadDayData = async (dateValue) => {
        if (dataCache.has(dateValue)) {
            const cached = dataCache.get(dateValue);
            touchCache(dateValue, cached);
            logEvent("info", "cache-hit", { dateValue });
            return cached;
        }
        if (pendingLoads.has(dateValue)) {
            logEvent("info", "pending-load-reused", { dateValue });
            return pendingLoads.get(dateValue);
        }
        const promise = (async () => {
            const dayData = await requestDayData(dateValue);
            touchCache(dateValue, dayData);
            return dayData;
        })().finally(() => {
            pendingLoads.delete(dateValue);
        });
        pendingLoads.set(dateValue, promise);
        return promise;
    };

    const FP_PATH = "./data/fig/" + ward + ".jpg";
    const STAGE_DIMENSIONS = {
        width: 1250,
        height: 1000,
    };
    const IMG_DIMENSIONS = {
        width: 1180,
        height: 880,
    };
    const PANEL_HEIGHT = 120;
    const a_x = 1;
    const b_x = 0;
    const a_y = 1;
    const b_y = PANEL_HEIGHT;

    const stage = d3
        .select(".stage")
        .attr("viewBox", `0 0 ${STAGE_DIMENSIONS.width} ${STAGE_DIMENSIONS.height}`)
        .attr("preserveAspectRatio", "xMinYMin meet");

    stage.append("image").attr("xlink:href", FP_PATH).attr("width", IMG_DIMENSIONS.width).attr("y", PANEL_HEIGHT);

    const circleLayer = stage.append("g").attr("class", "device-layer");
    const stayLayer = stage.append("g").attr("class", "stay-layer");

    const map = (value, a, b, beacon, devicePos) => {
        return STATION_LIST.includes(beacon) ? value * a + b + devicePos : value * a + b;
    };
    const getDevicePos = (device) => deviceStationPos[device] || [0, 0];
    const xMap = (x, device, beacon) => map(x, a_x, b_x, beacon, getDevicePos(device)[0]);
    const yMap = (y, device, beacon) => map(y, a_y, b_y, beacon, getDevicePos(device)[1]);

    const stayTimeBg = (stayTime, beacon) =>
        stayTime > 0 && !COLLIDOR_SET.has(beacon) ? BG_STAY_TIME : BG_STAY_TIME_CLEAR;
    const stayTimeText = (stayTime, beacon) =>
        stayTime > 0 && !COLLIDOR_SET.has(beacon) ? BG_TEXT_STAY_TIME : BG_TEXT_STAY_TIME_CLEAR;

    const updateSliderText = () => {
        dateTimeLabel.textContent = toDateTimeLabel(timeIdx);
    };

    const updateDeviceStationPos = () => {
        const COL_NUM = 4;
        deviceStationPos = {};
        for (let i = 0; i < deviceList.length; i++) {
            const device = deviceList[i];
            const x_idx = i % COL_NUM;
            const y_idx = Math.floor(i / COL_NUM);
            deviceStationPos[device] = [CIRCLE_R * 2.25 * x_idx, CIRCLE_R * -2.5 * y_idx];
        }
    };

    const removeDeviceLayers = () => {
        for (const nodes of deviceNodes.values()) {
            nodes.circle.remove();
            nodes.staffText.remove();
            nodes.stayRect.remove();
            nodes.stayText.remove();
        }
        deviceNodes.clear();
    };

    const setNodeVisible = (nodes, visible) => {
        if (!visible) {
            nodes.circle.interrupt();
            nodes.staffText.interrupt();
            nodes.stayRect.interrupt();
            nodes.stayText.interrupt();
        }
        const display = visible ? null : "none";
        nodes.circle.style("display", display);
        nodes.staffText.style("display", display);
        nodes.stayRect.style("display", display);
        nodes.stayText.style("display", display);
    };

    const getTransitionDurationMs = () => {
        const baseDuration = 250;
        let speedScale = 1;
        if (speedState === "play") {
            speedScale = playCount > 0 ? playCount : 1;
        } else if (speedState === "rewind") {
            speedScale = rewindCount > 0 ? rewindCount : 1;
        }
        return Math.round(baseDuration / speedScale);
    };

    const createDeviceLayers = () => {
        removeDeviceLayers();
        for (let i = 0; i < deviceList.length; i++) {
            const device = deviceList[i];
            const circle = circleLayer
                .append("circle")
                .style("stroke-width", 5)
                .attr("r", CIRCLE_R)
                .style("display", "none");
            const staffText = circleLayer
                .append("text")
                .attr("class", "staff_label")
                .attr("fill", "white")
                .attr("font-size", 28)
                .attr("text-anchor", "middle")
                .text(device.substr(6))
                .style("display", "none")
                .style("user-select", "none")
                .style("pointer-events", "none");
            const stayRect = stayLayer
                .append("rect")
                .attr("width", WIDTH_STAY_TIME)
                .attr("height", HEIGHT_STAY_TIME)
                .style("display", "none");
            const stayText = stayLayer
                .append("text")
                .attr("font-size", 18)
                .attr("text-anchor", "middle")
                .style("display", "none")
                .style("user-select", "none")
                .style("pointer-events", "none");
            deviceNodes.set(device, {
                circle,
                staffText,
                stayRect,
                stayText,
            });
        }
    };

    const renderNurseData = () => {
        const start = compactDayData.offsets[timeIdx];
        const end = compactDayData.offsets[timeIdx + 1];
        visibleByDevice.clear();
        const moveTransition = d3
            .transition()
            .duration(getTransitionDurationMs())
            .ease(d3.easeLinear);

        for (let i = start; i < end; i++) {
            const workCode = compactDayData.workCodes[i];
            const levelCode = compactDayData.levelCodes[i];
            if (!workFlagByCode[workCode]) {
                continue;
            }
            if (!levelFlagByCode[levelCode]) {
                continue;
            }
            const device = compactDayData.deviceList[compactDayData.deviceCodes[i]];
            visibleByDevice.set(device, i);
        }

        for (const [device, nodes] of deviceNodes.entries()) {
            const rowIndex = visibleByDevice.get(device);
            if (rowIndex === undefined) {
                setNodeVisible(nodes, false);
                continue;
            }
            const beacon = compactDayData.beaconList[compactDayData.beaconCodes[rowIndex]];
            const workLabel = WORK_LABELS[compactDayData.workCodes[rowIndex]];
            const levelLabel = LEVEL_LABELS[compactDayData.levelCodes[rowIndex]];
            const xValue = compactDayData.xValues[rowIndex];
            const yValue = compactDayData.yValues[rowIndex];
            const stayTime = compactDayData.stayValues[rowIndex];
            setNodeVisible(nodes, true);
            const x = xMap(xValue, device, beacon);
            const y = yMap(yValue, device, beacon);
            nodes.circle
                .style("fill", stateDictionary.work.active[workLabel])
                .style("stroke", stateDictionary.level.active[levelLabel])
                .transition(moveTransition)
                .attr("cx", x)
                .attr("cy", y);
            nodes.staffText
                .transition(moveTransition)
                .attr("x", x)
                .attr("y", y + 10);
            nodes.stayRect
                .style("fill", stayTimeBg(stayTime, beacon))
                .transition(moveTransition)
                .attr("x", x - WIDTH_STAY_TIME / 2)
                .attr("y", y - CIRCLE_R * 2);
            nodes.stayText
                .attr("fill", stayTimeText(stayTime, beacon))
                .text(stayTime)
                .transition(moveTransition)
                .attr("x", x)
                .attr("y", y - CIRCLE_R);
        }
    };

    function updateCircle() {
        renderNurseData();
    }

    function updateSlider() {
        timeSlider.value = String(timeIdx);
        updateSliderText();
    }

    function updateAll() {
        updateCircle();
        updateSlider();
    }

    const refreshPlaybackState = () => {
        btnPlay.classList.toggle("is-active", speedState === "play");
        btnRewind.classList.toggle("is-active", speedState === "rewind");
        btnPause.classList.toggle("is-active", speedState === "stop");
    };

    const refreshPlaybackLabels = () => {
        playLabel = "▶︎".repeat(playCount > 0 ? playCount : 1);
        rewindLabel = "◀︎".repeat(rewindCount > 0 ? rewindCount : 1);
        btnPlay.textContent = playLabel;
        btnRewind.textContent = rewindLabel;
    };

    function handleTimeChange(delta) {
        timeIdx += delta;
        if (timeIdx >= TIME_INDEX_LENGTH) {
            timeIdx = 0;
        } else if (timeIdx < 0) {
            timeIdx = TIME_INDEX_LENGTH - 1;
        }
        updateAll();
    }

    function handlePause() {
        timer.stop();
        speedState = "stop";
        refreshPlaybackState();
    }

    function handleNext() {
        handleTimeChange(1);
    }

    function handleNext30min() {
        handleTimeChange(1800);
    }

    function handlePrev() {
        handleTimeChange(-1);
    }

    function handlePrev30min() {
        handleTimeChange(-1800);
    }

    function handlePlay(count) {
        handlePause();
        speedState = "play";
        playCount += count;
        if (playCount > 3) {
            playCount = 1;
        }
        refreshPlaybackLabels();
        refreshPlaybackState();
        timer = d3.interval(function () {
            handleNext();
        }, 1000 / (FPS * playCount));
    }

    function handleRewind(count) {
        handlePause();
        speedState = "rewind";
        rewindCount += count;
        if (rewindCount > 3) {
            rewindCount = 1;
        }
        refreshPlaybackLabels();
        refreshPlaybackState();
        timer = d3.interval(function () {
            handlePrev();
        }, 1000 / (FPS * rewindCount));
    }

    const refreshWorkButtonStyles = () => {
        WORK_LABELS.forEach((label) => {
            const button = workButtons.get(label);
            if (!button) {
                return;
            }
            const enabled = stateDictionary.work.flag[label];
            button.style.backgroundColor = enabled
                ? stateDictionary.work.active[label]
                : stateDictionary.work.inactive[label];
            button.setAttribute("aria-pressed", enabled ? "true" : "false");
        });
    };

    const refreshLevelButtonStyles = () => {
        LEVEL_LABELS.forEach((label) => {
            const button = levelButtons.get(label);
            if (!button) {
                return;
            }
            const enabled = stateDictionary.level.flag[label];
            button.style.backgroundColor = enabled
                ? stateDictionary.level.active[label]
                : stateDictionary.level.inactive[label];
            button.setAttribute("aria-pressed", enabled ? "true" : "false");
        });
    };

    function updateWorkTimeState(work_time) {
        stateDictionary.work.flag[work_time] = !stateDictionary.work.flag[work_time];
        workFlagByCode[WORK_LABEL_TO_CODE[work_time]] = stateDictionary.work.flag[work_time];
        refreshWorkButtonStyles();
        updateAll();
    }

    function updateLevelState(level) {
        stateDictionary.level.flag[level] = !stateDictionary.level.flag[level];
        levelFlagByCode[LEVEL_LABEL_TO_CODE[level]] = stateDictionary.level.flag[level];
        refreshLevelButtonStyles();
        updateAll();
    }

    WORK_LABELS.forEach((label) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "filter-button";
        button.textContent = label;
        button.addEventListener("click", () => {
            updateWorkTimeState(label);
        });
        workFilterControls.appendChild(button);
        workButtons.set(label, button);
    });

    LEVEL_LABELS.forEach((label) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "filter-button";
        button.textContent = label;
        button.addEventListener("click", () => {
            updateLevelState(label);
        });
        levelFilterControls.appendChild(button);
        levelButtons.set(label, button);
    });

    btnPrev30min.addEventListener("click", handlePrev30min);
    btnNext30min.addEventListener("click", handleNext30min);
    btnPause.addEventListener("click", handlePause);
    btnPlay.addEventListener("click", () => handlePlay(1));
    btnRewind.addEventListener("click", () => handleRewind(1));

    const prefetchNeighborDates = () => {
        const currentIdx = selectDate.selectedIndex;
        const targetIndexes = [currentIdx - 1, currentIdx + 1];
        for (let i = 0; i < targetIndexes.length; i++) {
            const targetIdx = targetIndexes[i];
            if (targetIdx < 0 || targetIdx >= selectDate.options.length) {
                continue;
            }
            const candidate = selectDate.options[targetIdx].value;
            if (dataCache.has(candidate) || pendingLoads.has(candidate)) {
                continue;
            }
            loadDayData(candidate).catch((error) => {
                logEvent("warn", "prefetch-failed", {
                    dateValue: candidate,
                    error: error instanceof Error ? error.message : String(error),
                });
            });
        }
    };

    const applyDayData = (dateValue, dayData) => {
        setDateContext(dateValue);
        compactDayData = dayData || createEmptyDayData();
        deviceList = compactDayData.deviceList;
        visibleByDevice.clear();
        updateDeviceStationPos();
        createDeviceLayers();
        timeIdx = 0;
        updateAll();
    };

    const switchDate = async (dateValue) => {
        const token = ++dateSwitchToken;
        handlePause();
        showLoading();
        showStatus(`${dateValue} のデータを読み込み中...`, "loading");
        logEvent("info", "switch-date-started", {
            dateValue,
            token,
        });
        try {
            const dayData = await loadDayData(dateValue);
            if (token !== dateSwitchToken) {
                logEvent("info", "switch-date-superseded", {
                    dateValue,
                    token,
                    latestToken: dateSwitchToken,
                });
                return;
            }
            applyDayData(dateValue, dayData);
            prefetchNeighborDates();
            showStatus(`${dateValue} を表示中`, "success", 2500);
            logEvent("info", "switch-date-completed", {
                dateValue,
                token,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logEvent("error", "switch-date-failed", {
                dateValue,
                token,
                error: message,
            });
            showStatus(`データ読み込みに失敗しました: ${dateValue}`, "error", 7000);
        } finally {
            if (token === dateSwitchToken) {
                hideLoading();
            }
        }
    };

    timeSlider.addEventListener("input", () => {
        timeIdx = Number(timeSlider.value);
        updateAll();
    });

    selectDate.addEventListener("change", () => {
        const idx = selectDate.selectedIndex;
        switchDate(selectDate.options[idx].value);
    });

    refreshPlaybackLabels();
    refreshPlaybackState();
    refreshWorkButtonStyles();
    refreshLevelButtonStyles();

    const idx = selectDate.selectedIndex;
    switchDate(selectDate.options[idx].value);
}
