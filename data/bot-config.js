// GENERADO por Agentes/Consulta Aqui/exportar_bot_config.py -- NO EDITAR A MANO.
// Fuente de verdad: Agentes/Consulta Aqui/bot-config.json (editable desde el
// dashboard local, abrir.cmd). Para publicar un cambio de flujo: editar ahí,
// correr `python exportar_bot_config.py` de nuevo, y commitear este archivo.
// Se carga como <script>, no fetch, para que el sitio funcione tambien vía
// doble clic (file://) además de en Cloudflare Pages.

var BOT_CONFIG = {
  "ramas": [
    {
      "id": "ingenieria_civil",
      "label": "Ingeniería civil",
      "tiene_paso2": true,
      "contextos": [
        {
          "id": "diseno_estructural",
          "label": "Diseño estructural"
        },
        {
          "id": "calculo_estructural",
          "label": "Cálculo estructural"
        },
        {
          "id": "proyecto_especialidad",
          "label": "Proyecto de especialidad"
        },
        {
          "id": "otro",
          "label": "Otro"
        }
      ]
    },
    {
      "id": "construccion",
      "label": "Construcción",
      "tiene_paso2": true,
      "contextos": [
        {
          "id": "ejecucion_obra",
          "label": "Ejecución de obra"
        },
        {
          "id": "administracion_obra",
          "label": "Administración de obra"
        },
        {
          "id": "presupuesto_cubicacion",
          "label": "Presupuesto y cubicación"
        },
        {
          "id": "otro",
          "label": "Otro"
        }
      ]
    },
    {
      "id": "inspeccion",
      "label": "Inspección técnica",
      "tiene_paso2": true,
      "contextos": [
        {
          "id": "ito",
          "label": "Inspección técnica de obra (ITO)"
        },
        {
          "id": "recepcion_municipal",
          "label": "Recepción municipal"
        },
        {
          "id": "otro",
          "label": "Otro"
        }
      ]
    },
    {
      "id": "tasaciones",
      "label": "Tasaciones",
      "tiene_paso2": true,
      "contextos": [
        {
          "id": "comercial",
          "label": "Tasación comercial"
        },
        {
          "id": "hipotecaria",
          "label": "Tasación bancaria / hipotecaria"
        },
        {
          "id": "otro",
          "label": "Otro"
        }
      ]
    },
    {
      "id": "regularizacion",
      "label": "Regularización",
      "tiene_paso2": true,
      "contextos": [
        {
          "id": "construccion_dfl2",
          "label": "Regularización de construcción (Ley 21.542 / DFL2)"
        },
        {
          "id": "permiso_edificacion",
          "label": "Permiso de edificación"
        },
        {
          "id": "otro",
          "label": "Otro"
        }
      ]
    },
    {
      "id": "informacion",
      "label": "Información general",
      "tiene_paso2": false,
      "contextos": []
    },
    {
      "id": "otro",
      "label": "Otro",
      "tiene_paso2": false,
      "contextos": []
    }
  ]
};
