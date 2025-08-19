// Asegura que el diálogo arranque oculto y permite cerrar clicando el fondo
(function(){
  const dialog = document.getElementById("done-dialog");
  if (!dialog) return;
  dialog.classList.add("hidden");
  dialog.addEventListener("click", (e)=>{
    if (e.target === dialog) dialog.classList.add("hidden");
  });
})();