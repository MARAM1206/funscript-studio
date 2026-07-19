// ==========================================================================
// EXPORTADOR NATIVO A FORMATO .FUNSCRIPT
// ==========================================================================

// Capturamos el botón de exportación del HTML
const exportBtn = document.getElementById('export-btn');

/**
 * Transforma los datos en memoria a un archivo de texto JSON estructurado
 * y fuerza la descarga en el navegador.
 */
function exportToFunscript() {
    // Validación: Si el usuario no ha puesto puntos, avisamos y frenamos
    if (!funscriptActions || funscriptActions.length === 0) {
        alert("¡Espera! No has registrado ningún punto en la línea de tiempo todavía.");
        return;
    }

    // Estructura oficial del estándar internacional FunScript
    const funscriptData = {
        version: "1.0",
        inverted: false,
        range: 90, // Rango estándar de recorrido para la mayoría de los juguetes
        actions: funscriptActions // Tu lista ordenada de objetos { at: ms, pos: % }
    };

    // Convertimos el objeto de JavaScript a una cadena de texto JSON limpia
    const jsonString = JSON.stringify(funscriptData, null, 2);

    // Creamos un archivo virtual (Blob) de tipo texto/json en la memoria del navegador
    const blob = new Blob([jsonString], { type: "application/json" });

    // Generamos un enlace de descarga temporal oculto
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    
    // Nombramos el archivo. Por defecto usará 'script.funscript'
    link.download = "script.funscript";

    // Añadimos el enlace a la página por un milisegundo, lo clickeamos y lo borramos
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log("Archivo .funscript exportado y descargado con éxito.");
}

// Escuchamos el clic en el botón verde gigante
if (exportBtn) {
    exportBtn.addEventListener('click', exportToFunscript);
}
