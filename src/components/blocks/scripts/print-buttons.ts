/** The CV header's and contact box's print buttons */
document.querySelectorAll('#printCv, [data-print]').forEach((b) => b.addEventListener('click', () => window.print()));
