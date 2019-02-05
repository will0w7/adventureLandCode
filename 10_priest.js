game_log("---Priest Script Start---");
load_code(2);
let combat;
let state = "farm";

//Movement And Attacking
setInterval(function () {
    if (character.party && (state === 'farm' || combat)) {
        farm();
    } else if (state === 'resupply_potions') resupply_potions();
}, 100);//Execute 10 times per second

//Potions and state
setInterval(function () {
    state_controller();
    //Use mana pots and heal yourself, use healing pots if low
    if (character.hp < character.max_hp * 0.25) {
        if (can_use('use_hp')) use('use_hp');
        heal(character);
    } else if (can_use('use_mp') && character.mp < character.max_mp * 0.98) {
        use('use_mp');
    } else if (character.hp < character.max_hp * 0.75) {
        heal(character);
    } else if (character.hp < character.max_hp * 0.45) {
        if (can_use('use_hp')) use('use_hp');
        heal(character);
    }
}, 500);//Execute 2 times per second

function state_controller() {
    //If dead respawn
    if (character.rip) return respawn();
    //Default to farming
    let new_state = "farm";
    //Do we need potions?
    new_state = potion_check(new_state)
    //If state changed set it and announce
    if (state != new_state) {
        game_log("---NEW STATE " + new_state + "---");
        state = new_state;
    }
}

let alerted;
let lastHurt;
function farm()
{
    // Mark in combat if anyone in the party is being targeted
    if (character.party) combat = check_for_party_aggro()[0];
    let lowest_health = lowest_health_partymember();
    let curseTarget = find_leader_target();
    // Handle kiting
    if (curseTarget && distance_to_point(curseTarget.real_x, curseTarget.real_y) <= character.range * 0.7) {
        let kiteLocation = getKitePosition(curseTarget);
        if (kiteLocation) move_to_position(kiteLocation)
    }
    if (party_hurt_count(0.75) > 1 && can_use('partyheal')) {//MASS HEAL WHEN NEEDED
        use('partyheal');
    } else if (lowest_health && lowest_health.health_ratio < 0.85) { //HEAL WOUNDED
        lastHurt = lowest_health;
        if (!alerted) pm (lowest_health.name, 'Healing You!!');
        alerted = true;
        if (distance_to_point(lowest_health.real_x, lowest_health.real_y) <= character.range) {
            heal(lowest_health);
        } else {
            move_to_target(lowest_health);
        }
    } else if (dead_partymember()) { //REVIVE DEAD
        let dead_party = dead_partymember();
        if (can_use('revive') && distance_to_point(dead_party.real_x, dead_party.real_y) <= character.range) {
            use('revive', dead_party);
        } else {
            move_to_target(dead_party);
        }
    } else if (curseTarget && character.mp > character.max_mp * 0.85 && check_tank_aggro()) { //ATTACK IF YOU HAVE MANA
            if (can_use('curse') && check_tank_aggro()) {
                use('curse', curseTarget);
            } else {
                if (distance_to_point(curseTarget.real_x, curseTarget.real_y) <= character.range) {
                    if (can_attack(target) && check_tank_aggro())  attack(target);
                } else {
                    move_to_target(curseTarget, character.range * 0.5, character.range * 0.99);
                }
            }
    } else {
        alerted = undefined;
        move_to_leader(character.range * 0.5, character.range * 0.99);
    }
}