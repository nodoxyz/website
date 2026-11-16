# -*- coding: utf-8 -*-
"""Genera data/instituciones.js (lista de universidades, institutos profesionales y CFT) para el
campo «Universidad o instituto» de profesionales.html.

Fuente: Directorio de Instituciones de Educación Superior vigentes del Mineduc, mayo 2026,
https://www.ayudamineduc.cl/sites/default/files/ies_vig_may_26.xlsx (ficha «Instituciones vigentes
reconocidas por el Mineduc» de ayudamineduc.cl). Copia en data/_fuentes/ies_vig_may_26.xlsx.

Uso:  python data/_generar-instituciones.py [ruta-del-xlsx]

Cuando el Mineduc publique un directorio nuevo: bajarlo a data/_fuentes/, correr este script con esa
ruta y subir el ?v= de data/instituciones.js en profesionales.html. Si alguien corrige a mano un
nombre en instituciones.js, llevar la corrección a CORRECCIONES de acá antes de volver a correrlo,
o se pisa.
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

import openpyxl

AQUI = Path(__file__).resolve().parent
FUENTE = AQUI / "_fuentes" / "ies_vig_may_26.xlsx"
SALIDA = AQUI / "instituciones.js"

# Siglas que se escriben en mayúsculas. Todo lo demás pasa a mayúscula inicial.
SIGLAS = {"IACC", "AIEP", "UC", "INACAP", "IPG", "IPLACEX", "SEK", "UNIACC", "ICCE", "ENAC",
          "INFOMED", "INSALCO", "CEDUC", "UCN", "PUCV", "CFT", "EATRI", "I.T.C.", "C.F.T."}
MINUSCULAS = {"de", "del", "la", "las", "los", "y", "o", "e", "en"}

# Nombre que se muestra cuando el oficial tiene alias largos («X o Y»): se deja la primera forma.
CORRECCIONES = {}

GRUPO = {
    "UNIVERSIDAD ESTATAL": "Universidades",
    "UNIVERSIDAD PARTICULAR CON APORTES": "Universidades",
    "UNIVERSIDAD PRIVADA": "Universidades",
    "INSTITUTO PROFESIONAL": "Institutos profesionales",
    "CENTRO DE FORMACIÓN TÉCNICA": "Centros de formación técnica",
    "CENTRO DE FORMACIÓN TÉCNICA ESTATAL": "Centros de formación técnica",
}
ORDEN_GRUPOS = ["Universidades", "Institutos profesionales", "Centros de formación técnica"]


def palabra(p, primera):
    if p.upper() in SIGLAS:
        return p.upper()
    baja = p.lower()
    if not primera and baja in MINUSCULAS:
        return baja
    # O'HIGGINS -> O'Higgins; BÍO-BÍO -> Bío-Bío; DR. -> Dr.
    return re.sub(r"(^|['\-])(\w)", lambda m: m.group(1) + m.group(2).upper(), baja)


def nombre_legible(oficial):
    texto = re.sub(r"\s+", " ", oficial).strip()
    # «CFT DE ENAC O CENTRO DE FORMACIÓN TÉCNICA DE LOS ESTABLECIMIENTOS...»: se deja la primera forma.
    texto = re.split(r" O (?=C\.?F\.?T|CENTRO DE FORMACI)", texto)[0]
    partes = texto.split(" ")
    legible = " ".join(palabra(p, i == 0) for i, p in enumerate(partes))
    # El artículo va con mayúscula cuando es parte del nombre propio: Universidad de La Serena.
    return re.sub(r"\b(la|las|los) (?=(?:Frontera|Serena|República|Leones|Andes|Lagos|Ríos|Araucanía|Américas)\b)",
                  lambda m: m.group(1).capitalize() + " ", legible)


def main():
    ruta = Path(sys.argv[1]) if len(sys.argv) > 1 else FUENTE
    hoja = openpyxl.load_workbook(ruta, read_only=True).worksheets[0]
    filas = list(hoja.iter_rows(values_only=True))
    encabezado = [str(c or "").strip().upper() for c in filas[0]]
    i_reg, i_nom, i_tipo = (encabezado.index(c) for c in ("NÚMERO REGISTRO", "NOMBRE", "TIPO INSTITUCIÓN"))

    lista = []
    for fila in filas[1:]:
        if not fila or not fila[i_nom]:
            continue
        tipo = re.sub(r"\s+", " ", str(fila[i_tipo])).strip().upper()
        if tipo not in GRUPO:
            raise SystemExit(f"Tipo de institución desconocido: {tipo!r} ({fila[i_nom]})")
        codigo = str(fila[i_reg]).strip()
        nombre = CORRECCIONES.get(codigo) or nombre_legible(str(fila[i_nom]))
        lista.append({"codigo": codigo, "nombre": nombre, "grupo": GRUPO[tipo]})

    clave = lambda s: unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    lista.sort(key=lambda x: (ORDEN_GRUPOS.index(x["grupo"]), clave(x["nombre"])))

    cuerpo = ",\n".join("  " + json.dumps(x, ensure_ascii=False) for x in lista)
    SALIDA.write_text(
        "// Universidades, institutos profesionales y CFT vigentes (Directorio IES del Mineduc, mayo 2026).\n"
        "// GENERADO por data/_generar-instituciones.py: no editar a mano, corregir allá y volver a correrlo.\n"
        "// Se carga como <script> (no fetch), igual que localidades.js, para que funcione con file://.\n"
        f"var INSTITUCIONES = [\n{cuerpo}\n];\n",
        encoding="utf-8",
    )
    por_grupo = {g: sum(1 for x in lista if x["grupo"] == g) for g in ORDEN_GRUPOS}
    print(f"{len(lista)} instituciones -> {SALIDA.name}: {por_grupo}")


if __name__ == "__main__":
    main()
