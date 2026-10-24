// The one list of characters. Adding a character = add its folder name here; preview.html and render.html
// both load this file, which pulls in each characters/<id>/character.js (document.write keeps them synchronous).
(function () {
  const CHARACTERS = ['young', 'scammer', 'elder', 'worker', 'teller'];
  for (const id of CHARACTERS) document.write(`<script src="characters/${id}/character.js"><\/script>`);
})();
