"use strict";

(function registerMovementFilterConstants(root) {
    const WORK_LABELS = Object.freeze(["12時間", "日勤", "夜勤"]);
    const LEVEL_LABELS = Object.freeze(["未取得", "レベルⅠ", "レベルⅡ", "レベルⅢ", "レベルⅣ"]);

    const buildLabelToCode = (labels) =>
        Object.freeze(
            labels.reduce((acc, label, index) => {
                acc[label] = index;
                return acc;
            }, {})
        );

    root.MOVEMENT_FILTERS = Object.freeze({
        WORK_LABELS,
        LEVEL_LABELS,
        WORK_LABEL_TO_CODE: buildLabelToCode(WORK_LABELS),
        LEVEL_LABEL_TO_CODE: buildLabelToCode(LEVEL_LABELS),
    });
})(typeof self !== "undefined" ? self : window);
