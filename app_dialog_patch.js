// Drop-in JS patch to ensure the done dialog starts hidden and can be closed by clicking the backdrop
(function(){
  const dialog = document.getElementById("done-dialog");
  if (!dialog) return;
  // safety: make sure it's hidden on boot
  dialog.classList.add("hidden");
  // close when clicking the backdrop (outside the card)
  dialog.addEventListener("click", (e)=>{
    if (e.target === dialog) dialog.classList.add("hidden");
  });
})();