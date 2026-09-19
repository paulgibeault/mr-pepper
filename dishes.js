/* dishes.js — the names on the recipe cards, and nothing else.
 *
 * Pulled out of main.js so it can be tested without a DOM or an Arcade
 * global. `level` keeps climbing past the list and wraps; the cookbook (in
 * main.js) keys a dish by its position here, not by the level number, since
 * "served" has to mean the dish itself, not one particular cook of it.
 */

export const DISHES = [
  'Tomato Soup', 'Chili', 'Minestrone', 'Curry', 'Gumbo', 'Ratatouille', 'Pho', 'Goulash',
  'Paella', 'Tagine', 'Ramen', 'Bouillabaisse', 'Mole', 'Jambalaya', 'Laksa', 'Borscht',
  'Cioppino', 'Birria', 'Dal', 'Pozole', 'Rendang', 'Feijoada', 'Cassoulet', 'Vindaloo',
];

export const MAX_START = 20;

export const dishIndex = (level) => level % DISHES.length;
export const dishName = (level) => DISHES[dishIndex(level)];
