//Improved can_use runner
function can_use(name, target = undefined) {
    if (G.skills[name] && G.skills[name].class && !in_arr(character.ctype,G.skills[name].class)) return false; // checks the class
    if (G.skills[name] && G.skills[name].level && character.level < G.skills[name].level) return false; // checks the level
    if (G.skills[name] && G.skills[name].mp && character.mp < G.skills[name].mp) return false; // checks mp
    if (G.skills[name] && G.skills[name].wtype && !checkForWeaponType(G.skills[name].wtype)) return false; // checks for weapon
    if (G.skills[name] && G.skills[name].consume && !checkInventoryForItem(G.skills[name].consume)) return false; // checks for consumable
    if (target && G.skills[name] && G.skills[name].range && parent.distance(character, target) > G.skills[name].range) return false; // checks for range
    if (target && G.skills[name] && checkEntityForBuff(target, name)) return false; // checks if this is already applied
    return parent.can_use(name);  // checks the cooldown
}

// Fix party runners
function on_party_request(name) {
    accept_party_request(name);
}

// Fix party runners
function on_party_invite(name) {
    if (name === 'Shibtank') accept_party_invite(name);
}

// Check if entity has a buff
function checkEntityForBuff(entity, buff) {
    if (!entity.s) return false;
    return Object.keys(entity.s).includes(buff);
}

// Get all characters within range
function getNearbyCharacters(range = 200) {
    let characters = Object.values(parent.entities).filter(mob => parent.distance(character, mob) <= range && is_character(mob));
    if (characters.length) return characters; else return [];
}

// Get random int between 2
function getRndInteger(min, max) {
    return Math.floor(Math.random() * (max - min + 1) ) + min;
}

// Get distance to point
// TODO: is this needed with parent.distance??
function distanceToPoint(x, y) {
    return Math.sqrt(Math.pow(character.real_x - x, 2) + Math.pow(character.real_y - y, 2));
}

// Get distance to entity
// TODO: is this needed with parent.distance??
function distanceToEntity(target) {
    return Math.sqrt(Math.pow(character.real_x - target.real_x, 2) + Math.pow(character.real_y - target.real_y, 2));
}

// Distance between 2 points
function distanceBetweenPoints(x, y, x2, y2) {
    return Math.sqrt(Math.pow(x2 - x, 2) + Math.pow(y2 - y, 2));
}

// Shuffle array
function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Sort array of entities by distance
function sortEntitiesByDistance(array) {
    array.sort(function (current, next) {
        let dist_current = parent.distance(character, current);
        let dist_next = parent.distance(character, next);
        if (dist_current < dist_next) return -1; else if (dist_current > dist_next) return 1; else return 0;
    });
    return array;
}

// Sort array of entities by xp
function sortEntitiesByXp(array) {
    array.sort(function (current, next) {
        let xp_current = G.monsters[current].xp;
        let xp_next = G.monsters[next].xp;
        if (xp_current < xp_next) return -1; else if (xp_current > xp_next) return 1; else return 0;
    });
    return array;
}

function bankItemWithdraw(key, pack) {
    parent.socket.emit("bank",{operation:"swap",str:key,inv:-1,pack:pack});
}