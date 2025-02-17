/*
 * @author	D4ddy-LiLd4rk
 * @source	https://github.com/D4ddy-LiLd4rk/AdventureLand
 */

const baseURL = "https://raw.githubusercontent.com/will0w7/adventureLandCode/master/";

const allFiles = [
    "1_main.js",
    "2_requires.js",
    "5_common.js",
    "80_constants.js",
    "96_moveStuff.js",
    "97_gui.js",
    "99_helpers.js",
    "21_movement.js",
    "22_party.js",
    "23_shopping.js",
    "24_combat.js",
    "25_equipment.js",
    "26_bank.js",
    "27_targeting.js",
    "30_improvedRunners.js",
    "10_priest.js",
    "11_ranger.js",
    "12_warrior.js",
    "13_mage.js",
    "14_rogue.js",
    "15_merchant.js",
    "69_update.js"
];


function updateCode() {
    parent.api_call("list_codes", {
        callback: function () {
            game_log("Updating from GitHub...");
            for (let i = 1; i < allFiles.length; i++) {
                setTimeout(function loop() {
                    let request = new XMLHttpRequest();
                    request.open("GET", baseURL + allFiles[i - 1]);
                    request.onreadystatechange = function () {
                        if (request.readyState === 4 && request.status === 200) {
                            let codeObject = getCodeObject(allFiles[i - 1]);
                            let data = {
                                name: codeObject.name,
                                slot: codeObject.slot,
                                code: request.responseText
                            };
                            parent.api_call("save_code", data);
                        }
                    };
                    request.send();
                }, i * 1000);
            }
        }
    });
}

function getCodeObject(file) {
    let codeObject;

    let arr = file.substring(0, file.length - 3).split("_");

    codeObject = {
        slot: arr[0],
        name: arr[1]
    };

    return codeObject;
}