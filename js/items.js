/* Dead SectorZ — item definitions, loot tables, crafting recipes, build catalogue */
(function () {
  'use strict';
  const DSZ = window.DSZ, U = DSZ.U, O = DSZ.O;

  // type: tool|melee|gun|ammo|food|drink|med|mat|clothes|misc|bag|light|fuel
  const I = DSZ.ITEMS = {};
  function it(id, name, type, o) { I[id] = Object.assign({ id, name, type, w: 1, h: 1, stack: 1, icon: id, desc: '', col: '#aaa' }, o); }

  // ---- melee
  it('fists', 'Fists', 'melee', { dmg: 8, range: 1.0, rate: 0.45, stam: 4, noise: 4, hidden: true });
  it('bat', 'Baseball Bat', 'melee', { w: 1, h: 3, dmg: 26, range: 1.5, rate: 0.62, stam: 9, noise: 7, dur: 60, desc: 'Solid wood. Reliable.', col: '#b08848' });
  it('crowbar', 'Crowbar', 'melee', { w: 1, h: 3, dmg: 22, range: 1.4, rate: 0.5, stam: 7, noise: 7, dur: 90, pry: true, desc: 'Great for opening locked doors.', col: '#7a8088' });
  it('knife', 'Kitchen Knife', 'melee', { w: 1, h: 2, dmg: 14, range: 1.1, rate: 0.32, stam: 3, noise: 2, dur: 45, desc: 'Fast and quiet.', col: '#c4c8cc' });
  it('machete', 'Machete', 'melee', { w: 1, h: 3, dmg: 34, range: 1.6, rate: 0.55, stam: 8, noise: 4, dur: 80, desc: 'Cuts through the dead.', col: '#9aa0a4' });
  it('axe', 'Fire Axe', 'melee', { w: 2, h: 3, dmg: 48, range: 1.5, rate: 0.85, stam: 14, noise: 8, dur: 100, chop: true, pry: true, desc: 'Heavy. Chops wood and skulls.', col: '#c43c30' });
  it('pipe', 'Lead Pipe', 'melee', { w: 1, h: 3, dmg: 24, range: 1.4, rate: 0.6, stam: 9, noise: 8, dur: 120, desc: 'Heavy and dependable.', col: '#7c828a' });
  it('hammer', 'Hammer', 'melee', { w: 1, h: 2, dmg: 16, range: 1.1, rate: 0.45, stam: 5, noise: 6, dur: 100, tool: true, desc: 'Needed to build.', col: '#946a3c' });
  it('spear', 'Wooden Spear', 'melee', { w: 1, h: 4, dmg: 30, range: 2.0, rate: 0.7, stam: 8, noise: 3, dur: 40, desc: 'Long reach.', col: '#a07c48' });
  // ---- guns
  it('pistol', '9mm Pistol', 'gun', { w: 2, h: 2, dmg: 28, range: 18, rate: 0.28, mag: 12, ammo: 'ammo9', spread: 0.05, noise: 22, snd: 'gun_pistol', dur: 150, reload: 1.4, desc: 'Standard sidearm.', col: '#444' });
  it('shotgun', 'Pump Shotgun', 'gun', { w: 4, h: 2, dmg: 14, pellets: 8, range: 11, rate: 0.9, mag: 6, ammo: 'shell', spread: 0.2, noise: 32, snd: 'gun_shotgun', dur: 150, reload: 2.2, desc: 'Devastating up close.', col: '#5a3c22' });
  it('rifle', 'Hunting Rifle', 'gun', { w: 5, h: 2, dmg: 70, range: 30, rate: 0.95, mag: 5, ammo: 'ammo762', spread: 0.015, noise: 36, snd: 'gun_rifle', dur: 200, reload: 2.4, pierce: 2, desc: 'Accurate and powerful.', col: '#4c3820' });
  it('smg', 'SMG', 'gun', { w: 3, h: 2, dmg: 18, range: 16, rate: 0.085, mag: 30, ammo: 'ammo9', spread: 0.1, noise: 24, snd: 'gun_pistol', auto: true, dur: 120, reload: 1.8, desc: 'High rate of fire.', col: '#333' });
  // ---- ammo
  it('ammo9', '9mm Rounds', 'ammo', { stack: 40, col: '#c8a040', desc: 'Pistol / SMG ammunition.' });
  it('shell', 'Shotgun Shells', 'ammo', { stack: 20, col: '#c44030', desc: '12 gauge.' });
  it('ammo762', '7.62 Rounds', 'ammo', { stack: 20, col: '#a08038', desc: 'Rifle ammunition.' });
  // ---- food / drink
  it('beans', 'Canned Beans', 'food', { food: 28, water: -2, stack: 1, col: '#c8742c', desc: 'Still good.', eatSnd: 'eat' });
  it('soup', 'Canned Soup', 'food', { food: 22, water: 6, col: '#c43c2c' });
  it('bread', 'Stale Bread', 'food', { food: 18, water: -4, w: 2, h: 1, col: '#c8a060', rot: true });
  it('chips', 'Chips', 'food', { food: 12, water: -3, col: '#e0c040', rot: false });
  it('cereal', 'Cereal Box', 'food', { food: 24, water: -4, w: 1, h: 2, col: '#e8a030' });
  it('candy', 'Candy Bar', 'food', { food: 10, water: 0, col: '#8a4a2a', heal: 1 });
  it('apple', 'Apple', 'food', { food: 8, water: 6, col: '#c43030', rot: true });
  it('meat', 'Raw Meat', 'food', { food: 20, water: 0, sick: 18, col: '#b0403c', rot: true, cook: 'cooked' });
  it('cooked', 'Cooked Meat', 'food', { food: 42, water: 0, col: '#8c4a30', rot: true });
  it('mre', 'Military Ration', 'food', { food: 55, water: 8, w: 2, h: 1, col: '#5a6a3c', desc: 'Calorie dense.' });
  it('water', 'Water Bottle', 'drink', { water: 40, col: '#4a9ac8', dur: 1, desc: 'Clean water.', drinkSnd: 'drink', empty: 'bottle' });
  it('dirtywater', 'Dirty Water', 'drink', { water: 40, sick: 16, col: '#8a8a50', desc: 'Boil it first.', empty: 'bottle' });
  it('soda', 'Soda Can', 'drink', { water: 18, food: 4, col: '#c82838', empty: null });
  it('bottle', 'Empty Bottle', 'misc', { col: '#9ac0d0', desc: 'Fill at a rain collector.' });
  it('juice', 'Juice Box', 'drink', { water: 24, food: 8, col: '#e0883c' });
  // ---- medical
  it('bandage', 'Bandage', 'med', { bleed: true, heal: 6, col: '#e8e4d8', desc: 'Stops bleeding.', snd: 'bandage' });
  it('rags', 'Rags', 'mat', { stack: 8, col: '#a08c70', desc: 'Crafting material.' });
  it('painkillers', 'Painkillers', 'med', { heal: 0, pain: 40, col: '#e8e8f0' });
  it('medkit', 'First Aid Kit', 'med', { w: 2, h: 2, heal: 60, bleed: true, col: '#d83a3a', desc: 'Restores health.', snd: 'bandage' });
  it('antibiotics', 'Antibiotics', 'med', { cure: true, col: '#4a8ac8', desc: 'Cures infection.' });
  it('splint', 'Splint', 'med', { fix: true, w: 1, h: 2, col: '#b89460', desc: 'Fixes a broken leg.' });
  // ---- materials
  it('wood', 'Wood Plank', 'mat', { w: 1, h: 3, stack: 6, col: '#a8794a', desc: 'Building material.' });
  it('log', 'Log', 'mat', { w: 2, h: 2, stack: 4, col: '#7a5230', fuel: 90 });
  it('stick', 'Stick', 'mat', { stack: 10, col: '#8a6a3c', fuel: 20 });
  it('nails', 'Nails', 'mat', { stack: 30, col: '#9a9a9a' });
  it('scrap', 'Scrap Metal', 'mat', { stack: 12, col: '#8a8f96' });
  it('metalplate', 'Metal Plate', 'mat', { w: 2, h: 2, stack: 4, col: '#7a828c' });
  it('tape', 'Duct Tape', 'mat', { stack: 3, col: '#8a8a90', desc: 'Fixes everything.' });
  it('cloth', 'Cloth', 'mat', { stack: 8, col: '#b0a890' });
  it('wire', 'Wire', 'mat', { stack: 6, col: '#c08040' });
  it('cement', 'Cement Mix', 'mat', { w: 2, h: 2, stack: 2, col: '#8a8a86' });
  it('battery', 'Battery', 'mat', { stack: 3, col: '#3ca048', desc: 'Powers flashlights.' });
  it('gascan', 'Gas Can', 'fuel', { w: 2, h: 2, fuel: 100, maxfuel: 100, col: '#c4382c', desc: 'Fuel for cars and fires.' });
  it('lighter', 'Lighter', 'tool', { col: '#d8a830', desc: 'Starts fires.' });
  it('matches', 'Matches', 'tool', { col: '#c04a30' });
  it('rope', 'Rope', 'mat', { stack: 2, w: 1, h: 2, col: '#b8a070' });
  it('sheetmetal', 'Sheet Metal', 'mat', { w: 2, h: 3, stack: 3, col: '#707880' });
  it('plank_bundle', 'Plank Bundle', 'mat', { w: 2, h: 3, col: '#a8794a' });
  it('fusebox', 'Fuse', 'mat', { col: '#c8c040' });
  it('chemicals', 'Chemicals', 'mat', { col: '#6ac84a' });
  it('keys', 'Car Keys', 'misc', { col: '#d8c040', key: true, desc: 'Starts a vehicle.' });
  it('sparkplug', 'Spark Plug', 'mat', { col: '#d0d0d0' });
  it('tire', 'Tire', 'mat', { w: 2, h: 2, col: '#222' });
  // ---- tools / light
  it('flashlight', 'Flashlight', 'light', { w: 1, h: 2, col: '#d8c040', cone: 0.62, range: 17, bat: 100, desc: 'Equip to light the dark. Uses batteries.' });
  it('torch', 'Torch', 'light', { w: 1, h: 3, col: '#c86a28', cone: 6.28, range: 9, burn: 300, desc: 'Burns for a while.' });
  it('lantern', 'Oil Lantern', 'light', { w: 1, h: 2, col: '#d89038', cone: 6.28, range: 11, burn: 800 });
  it('map', 'Town Map', 'tool', { col: '#c4b48a', desc: 'Press M to open.' });
  it('radio', 'Radio', 'misc', { w: 2, h: 1, col: '#555' });
  // ---- clothing / bags
  // upper body (BODY slot): only ONE at a time; a VEST is a separate slot worn over it.
  // Trade-off: more protection or warmth = a bigger footprint (more carried weight + bag space)
  it('tshirt', 'T-shirt', 'clothes', { slot: 'body', def: 0, col: '#5a7a9a', desc: 'Plain and worn.' });
  it('flannel', 'Flannel Shirt', 'clothes', { w: 1, h: 2, slot: 'body', def: 3, warm: 9, col: '#9c3a34', desc: 'Light work shirt. Cheap and common.' });
  it('sweater', 'Wool Sweater', 'clothes', { w: 2, h: 2, slot: 'body', def: 2, warm: 18, col: '#b8862e', desc: 'Very warm, but no real protection.' });
  it('jacket', 'Jacket', 'clothes', { w: 2, h: 2, slot: 'body', def: 8, warm: 10, col: '#4a5a6a' });
  it('hoodie', 'Hoodie', 'clothes', { w: 2, h: 2, slot: 'body', def: 5, warm: 14, col: '#6a4a4a' });
  it('leather', 'Leather Jacket', 'clothes', { w: 2, h: 2, slot: 'body', def: 12, warm: 6, col: '#3e2e26', desc: 'Tough hide. Poor insulation.' });
  it('padded', 'Padded Jacket', 'clothes', { w: 2, h: 3, slot: 'body', def: 16, warm: 5, col: '#38414e', desc: 'Best body armour, but bulky and cold.' });
  it('wintercoat', 'Winter Coat', 'clothes', { w: 3, h: 2, slot: 'body', def: 5, warm: 26, col: '#a5602c', desc: 'Warmest coat. Huge and heavy.' });
  // vest slot: worn over the BODY clothing, drawn as an overlay layer
  it('vest', 'Kevlar Vest', 'clothes', { w: 2, h: 2, slot: 'vest', def: 38, warm: 4, col: '#3a4046', desc: 'Reduces bite damage.' });
  it('helmet', 'Helmet', 'clothes', { w: 2, h: 2, slot: 'head', def: 20, warm: 3, col: '#4c5436' });
  it('cap', 'Cap', 'clothes', { slot: 'head', def: 2, warm: 3, col: '#4a6a8a' });
  // legs (LEGS slot): pocket capacity differs per item (cols/rows like bags)
  it('shorts', 'Shorts', 'clothes', { w: 1, h: 2, slot: 'legs', def: 0, cols: 2, rows: 1, col: '#c8b48a', desc: 'Two pockets.' });
  it('jeans', 'Jeans', 'clothes', { w: 2, h: 2, slot: 'legs', def: 1, cols: 2, rows: 1, col: '#3a5a8c', desc: 'Sturdy denim.' });
  it('trousers', 'Trousers', 'clothes', { w: 2, h: 2, slot: 'legs', def: 1, cols: 2, rows: 1, col: '#8a8f96', desc: 'Two pockets.' });
  it('tracksuit', 'Tracksuit Pants', 'clothes', { w: 1, h: 2, slot: 'legs', def: 0, cols: 1, rows: 1, col: '#3c5a48', desc: 'Comfortable.' });
  it('cargopants', 'Cargo Pants', 'clothes', { w: 2, h: 2, slot: 'legs', def: 2, cols: 2, rows: 2, col: '#5a6248', desc: 'Cargo pockets.' });
  // feet (FEET slot): sneakers are quieter than boots; running shoes add a small speed bonus
  it('sneakers', 'Sneakers', 'clothes', { w: 1, h: 1, slot: 'feet', def: 1, warm: 2, quiet: 2.5, col: '#8a8a8a', desc: 'Quiet steps.' });
  it('runners', 'Running Shoes', 'clothes', { w: 1, h: 1, slot: 'feet', def: 0, warm: 1, quiet: 3, speed: 0.08, col: '#c8c8d0', desc: 'Light. Faster running.' });
  it('boots', 'Boots', 'clothes', { w: 2, h: 2, slot: 'feet', def: 6, warm: 6, col: '#5a4028' });
  it('backpack', 'Backpack', 'bag', { w: 2, h: 3, slot: 'bag', cols: 8, rows: 5, col: '#5c6a46', desc: '+ storage' });
  it('bigpack', 'Hiking Pack', 'bag', { w: 3, h: 3, slot: 'bag', cols: 10, rows: 7, col: '#8a4a30', desc: '++ storage' });
  it('fannypack', 'Fanny Pack', 'bag', { slot: 'bag', cols: 5, rows: 2, col: '#4a4a52' });

  // ----------------------------------------------------------------- loot tables
  // [id, weight, minQty, maxQty]
  const L = DSZ.LOOT = {
    kitchen: { n: [1, 3], t: [['beans', 8], ['soup', 7], ['bread', 5], ['chips', 4], ['cereal', 5], ['water', 5], ['soda', 5], ['knife', 4], ['matches', 3], ['lighter', 1.5], ['rags', 3], ['bottle', 3], ['juice', 3]] },
    fridge: { n: [0, 3], t: [['meat', 5], ['soda', 8], ['juice', 6], ['apple', 6], ['water', 6], ['candy', 4]] },
    bedroom: { n: [0, 2], t: [['rags', 5], ['cloth', 4], ['painkillers', 3], ['candy', 2], ['flashlight', 1.2], ['battery', 3], ['cap', 2], ['sneakers', 1.5], ['bandage', 2], ['radio', 1]] },
    clothes: { n: [1, 3], t: [['jacket', 4], ['hoodie', 4], ['flannel', 5], ['sweater', 3], ['leather', 1.8], ['cap', 4], ['boots', 3], ['sneakers', 3], ['jeans', 5], ['trousers', 3], ['tracksuit', 2], ['cargopants', 1.5], ['cloth', 6], ['rags', 6], ['fannypack', 2], ['backpack', 1.4]] },
    living: { n: [0, 2], t: [['battery', 4], ['rags', 3], ['candy', 3], ['chips', 3], ['soda', 3], ['radio', 1], ['lighter', 2], ['tape', 1]] },
    books: { n: [0, 1], t: [['rags', 3], ['map', 2], ['matches', 3], ['candy', 1]] },
    medical: { n: [0, 3], t: [['bandage', 9], ['painkillers', 6], ['antibiotics', 2.5], ['splint', 1.5], ['medkit', 1.2], ['rags', 3]] },
    hospital: { n: [1, 4], t: [['bandage', 8], ['painkillers', 6], ['antibiotics', 5], ['medkit', 4], ['splint', 3], ['water', 3]] },
    pharmacy: { n: [1, 4], t: [['bandage', 8], ['painkillers', 8], ['antibiotics', 4], ['medkit', 3], ['candy', 3], ['water', 3], ['splint', 1.5]] },
    ward: { n: [0, 2], t: [['bandage', 6], ['painkillers', 3], ['rags', 3], ['splint', 1]] },
    grocery: { n: [1, 3], t: [['beans', 10], ['soup', 8], ['bread', 5], ['chips', 7], ['cereal', 6], ['water', 8], ['soda', 8], ['juice', 6], ['apple', 4], ['candy', 6], ['mre', 0.6]] },
    store: { n: [1, 3], t: [['beans', 4], ['water', 4], ['soda', 4], ['chips', 4], ['battery', 4], ['flashlight', 2], ['lighter', 2], ['tape', 3], ['rags', 3], ['backpack', 1.2], ['map', 1.5]] },
    hardware: { n: [1, 3], t: [['nails', 8], ['hammer', 3.5], ['crowbar', 3], ['wood', 5], ['scrap', 5], ['tape', 5], ['wire', 5], ['axe', 1.2], ['pipe', 3], ['battery', 3], ['flashlight', 2.5], ['gascan', 2], ['sheetmetal', 2.5], ['rope', 3], ['cement', 1.5], ['metalplate', 1.5]] },
    clothing: { n: [1, 3], t: [['jacket', 6], ['hoodie', 6], ['flannel', 5], ['sweater', 5], ['leather', 3], ['padded', 1.5], ['wintercoat', 1.5], ['cap', 5], ['boots', 5], ['sneakers', 4], ['runners', 2.5], ['jeans', 5], ['trousers', 4], ['tracksuit', 3], ['cargopants', 2], ['cloth', 6], ['fannypack', 3], ['backpack', 3], ['bigpack', 0.8]] },
    electronics: { n: [1, 3], t: [['battery', 10], ['flashlight', 5], ['radio', 3], ['wire', 5], ['tape', 3], ['fusebox', 3]] },
    gas: { n: [1, 3], t: [['gascan', 3], ['soda', 6], ['chips', 6], ['candy', 6], ['water', 5], ['map', 3], ['battery', 3], ['lighter', 3], ['keys', 0.6]] },
    guns: { n: [1, 3], t: [['pistol', 3], ['shotgun', 1.8], ['rifle', 1.2], ['ammo9', 6], ['shell', 4], ['ammo762', 3], ['knife', 3], ['machete', 2], ['vest', 0.8]] },
    police: { n: [1, 3], t: [['pistol', 4], ['ammo9', 8], ['vest', 1.5], ['flashlight', 3], ['bandage', 3], ['keys', 1.5], ['radio', 1], ['helmet', 1], ['smg', 0.4]] },
    armory: { n: [2, 4], t: [['pistol', 3], ['shotgun', 3], ['rifle', 2], ['smg', 1.4], ['ammo9', 8], ['shell', 6], ['ammo762', 5], ['vest', 2.5], ['helmet', 2.5], ['medkit', 1]] },
    cell: { n: [0, 1], t: [['rags', 4], ['cloth', 3], ['candy', 2]] },
    locker: { n: [0, 2], t: [['jacket', 3], ['flannel', 3], ['leather', 1.5], ['boots', 2], ['flashlight', 3], ['cap', 3], ['battery', 3], ['bandage', 2], ['crowbar', 2], ['mre', 0.8], ['water', 3]] },
    office: { n: [0, 2], t: [['tape', 3], ['battery', 3], ['candy', 3], ['soda', 3], ['painkillers', 2], ['keys', 1.2], ['map', 1.5], ['water', 2]] },
    industrial: { n: [1, 3], t: [['scrap', 8], ['metalplate', 3], ['wire', 4], ['nails', 4], ['gascan', 3], ['pipe', 3], ['tape', 3], ['wood', 4], ['sheetmetal', 3], ['chemicals', 2], ['cement', 2], ['tire', 2]] },
    tools: { n: [1, 3], t: [['hammer', 5], ['nails', 7], ['crowbar', 3], ['wire', 4], ['pipe', 3], ['axe', 1.2], ['battery', 3], ['scrap', 4], ['tape', 3]] },
    storage: { n: [1, 3], t: [['scrap', 4], ['nails', 3], ['wood', 3], ['tape', 3], ['rags', 3], ['beans', 3], ['water', 3], ['battery', 3]] },
    attic: { n: [0, 2], t: [['rags', 5], ['cloth', 5], ['wood', 3], ['rope', 2], ['tape', 2], ['nails', 2], ['lantern', 0.8], ['jacket', 1.5], ['wintercoat', 1]] },
    trash: { n: [0, 2], t: [['rags', 6], ['scrap', 4], ['bottle', 5], ['soda', 3], ['cloth', 3], ['bread', 2], ['tape', 1], ['nails', 1.5]] },
    mail: { n: [0, 1], t: [['candy', 2], ['rags', 2], ['map', 1], ['keys', 0.6]] },
    register: { n: [0, 1], t: [['candy', 3], ['battery', 2], ['keys', 1], ['lighter', 3]] },
    church: { n: [0, 2], t: [['candy', 2], ['bread', 3], ['water', 3], ['cloth', 3], ['rags', 3], ['lantern', 1.2], ['medkit', 0.5]] },
    zombie: { n: [0, 2], t: [['rags', 5], ['candy', 3], ['cloth', 3], ['keys', 0.8], ['lighter', 1], ['bandage', 1.5], ['ammo9', 1], ['water', 1.5], ['beans', 1]], none: 0.55 },
    car: { n: [0, 2], t: [['rags', 3], ['gascan', 2], ['tape', 2], ['battery', 2], ['flashlight', 1.2], ['soda', 2], ['crowbar', 1.2], ['tire', 1.5], ['map', 2], ['keys', 0.7]] },
    cartrunk: { n: [0, 3], t: [['scrap', 3], ['tire', 2], ['gascan', 2.5], ['wire', 2], ['rags', 3], ['tape', 2], ['water', 2], ['beans', 2], ['backpack', 0.8], ['crowbar', 1.5]] }
  };
  DSZ.rollLoot = function (rng, table, bonus) {
    const T = L[table]; if (!T) return [];
    const out = [];
    let n = T.n[0] + ((rng() * (T.n[1] - T.n[0] + 1)) | 0) + (bonus || 0);
    if (T.none && rng() < T.none) return out;
    for (let i = 0; i < n; i++) {
      const id = U.weighted(rng, T.t), d = I[id];
      let q = 1;
      if (d.stack > 1) q = 1 + ((rng() * Math.min(d.stack, id === 'nails' ? 12 : (d.type === 'ammo' ? 12 : 3))) | 0);
      const item = { id, q };
      if (d.type === 'gun') item.mag = 0;
      if (d.dur) item.dur = Math.max(1, Math.round(d.dur * (0.35 + rng() * 0.65)));
      if (d.id === 'gascan') item.fuel = (rng() * 70) | 0;
      if (d.id === 'flashlight') item.bat = 20 + ((rng() * 80) | 0);
      if (d.id === 'torch' || d.id === 'lantern') item.burn = d.burn;
      if (d.type === 'drink' && id === 'water') item.q = 1;
      out.push(item);
    }
    return out;
  };

  // ----------------------------------------------------------------- crafting (Unturned-style tabs)
  // each: id, tab, out:[id,qty], in:[[id,qty]...], station?:'bench'|'fire'|null, needs?: tool id
  const R = DSZ.RECIPES = [
    // survival
    { id: 'r_bandage', tab: 'Medical', out: ['bandage', 2], in: [['rags', 2]], desc: 'Clean rag bandages.' },
    { id: 'r_splint', tab: 'Medical', out: ['splint', 1], in: [['stick', 2], ['rags', 1]] },
    { id: 'r_medkit', tab: 'Medical', out: ['medkit', 1], in: [['bandage', 3], ['painkillers', 1], ['tape', 1]], station: 'bench' },
    { id: 'r_cooked', tab: 'Survival', out: ['cooked', 1], in: [['meat', 1]], station: 'fire', desc: 'Cook raw meat over a fire.' },
    { id: 'r_boil', tab: 'Survival', out: ['water', 1], in: [['dirtywater', 1]], station: 'fire', desc: 'Boil to purify.' },
    { id: 'r_torch', tab: 'Survival', out: ['torch', 1], in: [['stick', 2], ['rags', 1]], desc: 'Cloth wrapped on a stick.' },
    { id: 'r_stick', tab: 'Survival', out: ['stick', 3], in: [['log', 1]] },
    { id: 'r_wood', tab: 'Survival', out: ['wood', 3], in: [['log', 1]], needs: 'axe', desc: 'Needs an axe in your pack.' },
    { id: 'r_rags', tab: 'Survival', out: ['rags', 2], in: [['cloth', 1]] },
    { id: 'r_lantern', tab: 'Survival', out: ['lantern', 1], in: [['scrap', 2], ['gascan', 0], ['rags', 1]], station: 'bench' },
    { id: 'r_bat', tab: 'Weapons', out: ['bat', 1], in: [['wood', 2], ['tape', 1]], desc: 'Wooden bat wrapped in tape.' },
    { id: 'r_spear', tab: 'Weapons', out: ['spear', 1], in: [['stick', 2], ['knife', 1], ['rope', 1]], desc: 'Knife lashed to a stick.' },
    { id: 'r_pipe', tab: 'Weapons', out: ['pipe', 1], in: [['scrap', 4]], station: 'bench' },
    { id: 'r_machete', tab: 'Weapons', out: ['machete', 1], in: [['scrap', 4], ['tape', 1], ['wood', 1]], station: 'bench' },
    { id: 'r_ammo9', tab: 'Weapons', out: ['ammo9', 8], in: [['scrap', 2], ['chemicals', 1]], station: 'bench' },
    { id: 'r_shell', tab: 'Weapons', out: ['shell', 4], in: [['scrap', 2], ['chemicals', 1]], station: 'bench' },
    { id: 'r_vest', tab: 'Gear', out: ['vest', 1], in: [['cloth', 4], ['metalplate', 2], ['tape', 2]], station: 'bench' },
    { id: 'r_helmet', tab: 'Gear', out: ['helmet', 1], in: [['metalplate', 1], ['cloth', 2], ['tape', 1]], station: 'bench' },
    { id: 'r_backpack', tab: 'Gear', out: ['backpack', 1], in: [['cloth', 6], ['tape', 2], ['rope', 1]] },
    { id: 'r_fanny', tab: 'Gear', out: ['fannypack', 1], in: [['cloth', 2], ['tape', 1]] },
    { id: 'r_plank', tab: 'Materials', out: ['wood', 1], in: [['plank_bundle', 1]] },
    { id: 'r_scrap_plate', tab: 'Materials', out: ['metalplate', 1], in: [['scrap', 4]], station: 'bench' },
    { id: 'r_tape', tab: 'Materials', out: ['tape', 1], in: [['cloth', 2], ['chemicals', 1]] },
    { id: 'r_rope', tab: 'Materials', out: ['rope', 1], in: [['cloth', 3]] }
  ];

  // ----------------------------------------------------------------- base-building catalogue
  const B = DSZ.BUILD = [
    { id: 'bwall_w', obj: O.BWALL_W, name: 'Wood Wall', tab: 'Walls', cost: [['wood', 3], ['nails', 4]], desc: 'Basic barricade.' },
    { id: 'bwall_m', obj: O.BWALL_M, name: 'Metal Wall', tab: 'Walls', cost: [['sheetmetal', 2], ['nails', 6]], desc: 'Tough as nails.' },
    { id: 'bdoor', obj: O.BDOOR, name: 'Door', tab: 'Walls', cost: [['wood', 3], ['nails', 4]], desc: 'Lockable door.' },
    { id: 'bwin', obj: O.BWINDOW, name: 'Barricaded Window', tab: 'Walls', cost: [['wood', 2], ['nails', 4]], desc: 'See out, hard to get in.' },
    { id: 'bfence', obj: O.BFENCE, name: 'Wood Fence', tab: 'Defense', cost: [['wood', 2], ['nails', 2]], desc: 'Slows zombies.' },
    { id: 'bgate', obj: O.BGATE, name: 'Gate', tab: 'Defense', cost: [['wood', 3], ['nails', 3]] },
    { id: 'bbarr', obj: O.BBARR, name: 'Spike Barricade', tab: 'Defense', cost: [['wood', 2], ['scrap', 3], ['nails', 3]], desc: 'Hurts zombies that push through.' },
    { id: 'bstore', obj: O.BSTORAGE, name: 'Storage Chest', tab: 'Furniture', cost: [['wood', 4], ['nails', 6]], desc: 'Large stash.' },
    { id: 'bbed', obj: O.BBED, name: 'Bed', tab: 'Furniture', cost: [['wood', 3], ['cloth', 4], ['nails', 3]], desc: 'Sleep to recover energy and pass time.' },
    { id: 'bbench', obj: O.BWORKBENCH, name: 'Workbench', tab: 'Utility', cost: [['wood', 4], ['nails', 8], ['scrap', 4]], desc: 'Unlocks advanced crafting.' },
    { id: 'bfire', obj: O.BFIRE, name: 'Campfire', tab: 'Utility', cost: [['log', 1], ['stick', 3]], desc: 'Light, warmth, cooking.' },
    { id: 'bfurn', obj: O.BFURNACE, name: 'Furnace', tab: 'Utility', cost: [['scrap', 8], ['cement', 1]], desc: 'Hot, bright. Cooks and smelts.' },
    { id: 'blamp', obj: O.BLAMP, name: 'Lantern Post', tab: 'Utility', cost: [['wood', 1], ['scrap', 1], ['rags', 2]], desc: 'Lights the area.' },
    { id: 'brain', obj: O.BRAIN, name: 'Rain Collector', tab: 'Utility', cost: [['scrap', 4], ['tape', 1]], desc: 'Fills bottles when it rains.' }
  ];
})();
