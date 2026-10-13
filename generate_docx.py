import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = OxmlElement('w:tcMar')
    for m, val in [('top', top), ('bottom', bottom), ('left', left), ('right', right)]:
        node = OxmlElement(f'w:{m}')
        node.set(qn('w:w'), str(val))
        node.set(qn('w:type'), 'dxa')
        tcMar.append(node)
    tcPr.append(tcMar)

def create_document():
    doc = docx.Document()

    # Configuración de márgenes estándar (1 pulgada)
    for section in doc.sections:
        section.top_margin = Inches(1)
        section.bottom_margin = Inches(1)
        section.left_margin = Inches(1)
        section.right_margin = Inches(1)

    # Colores temáticos
    COLOR_PRIMARY = RGBColor(180, 50, 25)    # Terracota / Magma
    COLOR_SECONDARY = RGBColor(40, 40, 40)   # Carbón oscuro
    COLOR_MUTED = RGBColor(100, 100, 100)    # Gris medio

    # =========================================================================
    # TÍTULO Y CABECERA
    # =========================================================================
    p_kicker = doc.add_paragraph()
    r_kicker = p_kicker.add_run("IIC2026 VISUALIZACIÓN DE INFORMACIÓN · PONTIFICIA UNIVERSIDAD CATÓLICA DE CHILE")
    r_kicker.font.size = Pt(8.5)
    r_kicker.font.bold = True
    r_kicker.font.color.rgb = RGBColor(170, 110, 40)
    p_kicker.paragraph_format.space_after = Pt(2)

    p_title = doc.add_paragraph()
    r_title = p_title.add_run("El Cinturón de Fuego: Amenaza Oculta y Poblaciones Bajo el Volcán")
    r_title.font.size = Pt(22)
    r_title.font.bold = True
    r_title.font.color.rgb = COLOR_PRIMARY
    p_title.paragraph_format.space_after = Pt(4)

    p_sub = doc.add_paragraph()
    r_sub = p_sub.add_run("Memoria Técnica de Diseño, Explicación de Código y Rationale para la Entrega 1")
    r_sub.font.size = Pt(12)
    r_sub.font.italic = True
    r_sub.font.color.rgb = COLOR_MUTED
    p_sub.paragraph_format.space_after = Pt(20)

    # Línea divisoria
    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_after = Pt(16)
    p_div_run = p_div.add_run("―" * 52)
    p_div_run.font.color.rgb = RGBColor(210, 200, 190)

    # =========================================================================
    # SECCIÓN 1: RESUMEN EJECUTIVO Y PREGUNTA CENTRAL
    # =========================================================================
    h1 = doc.add_heading(level=1)
    r_h1 = h1.add_run("1. Resumen Ejecutivo y Pregunta Central")
    r_h1.font.color.rgb = COLOR_PRIMARY

    p1 = doc.add_paragraph()
    p1.add_run("La visualización responde a una pregunta analítica concreta: ")
    r_bold1 = p1.add_run("¿Qué hace a un volcán verdaderamente peligroso?")
    r_bold1.bold = True
    p1.add_run(
        " La intuición común asume que los volcanes más letales son aquellos con las erupciones más explosivas "
        "(Índice de Explosividad Volcánica VEI 6 o 7). Sin embargo, al cruzar el catálogo histórico del Smithsonian Institution "
        "(Global Volcanism Program) con el modelo demográfico satelital LandScan (Oak Ridge National Laboratory), "
        "se evidencia que la mayor amenaza humanitaria no radica únicamente en la fuerza tectónica aislada, "
        "sino en la densidad de las poblaciones que habitan directamente en su zona de evacuación inmediata."
    )

    # Callout Box: Mensaje principal
    tbl_callout = doc.add_table(rows=1, cols=1)
    tbl_callout.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl_callout.cell(0, 0)
    set_cell_background(cell, "F7F3EE")
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    p_c = cell.paragraphs[0]
    p_c.paragraph_format.space_after = Pt(0)
    r_c_tag = p_c.add_run("Mensaje Central de la Visualización:\n")
    r_c_tag.bold = True
    r_c_tag.font.size = Pt(9.5)
    r_c_tag.font.color.rgb = COLOR_PRIMARY
    r_c_text = p_c.add_run(
        "«Un volcán de explosividad moderada (VEI 4–5) con 2 millones de personas a menos de 10 km (ej. Campi Flegrei o Ilopango) "
        "representa un riesgo humanitario inmensamente más crítico que un supervolcán VEI 7 en un territorio deshabitado.»"
    )
    r_c_text.font.italic = True
    r_c_text.font.size = Pt(10)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # =========================================================================
    # SECCIÓN 2: CÓMO FUNCIONA LA VISUALIZACIÓN
    # =========================================================================
    h2 = doc.add_heading(level=1)
    r_h2 = h2.add_run("2. Cómo Funciona la Visualización (Flujo de Experiencia)")
    r_h2.font.color.rgb = COLOR_PRIMARY

    p2 = doc.add_paragraph(
        "La experiencia fue diseñada bajo el concepto de un único escenario inmersivo continuo, eliminando divisiones de pantalla "
        "y permitiendo que la interacción táctil, visual y sonora ocurran de manera sincronizada:"
    )

    items_flujo = [
        ("1. Vista General (Overview): ", "El usuario visualiza de inmediato la totalidad del Cinturón de Fuego del Pacífico sin interrupciones. Cada uno de los 958 volcanes se representa mediante un círculo cuyo color codifica su VEI histórico máximo y cuyo tamaño codifica directamente la población expuesta en su zona de evacuación inmediata (10 km)."),
        ("2. Exploración en Hover: ", "Al pasar el cursor sobre cualquier volcán, la marca se ilumina en blanco y se eleva visualmente sobre sus vecinos. Al mismo tiempo, el sistema emite un clic acústico sutil y despliega un tooltip con el nombre, país, VEI y recuento demográfico."),
        ("3. Selección Directa (Clic): ", "Al hacer clic sobre un volcán, la cámara de D3 realiza un acercamiento cinemático centrado en el cráter. En ese instante, se proyectan sobre el mapa los cuatro anillos concéntricos geográficos a escala real (5 km, 10 km, 30 km y 100 km)."),
        ("4. Sonificación Multidimensional: ", "La interacción activa el motor sonoro en Tone.js: un estruendo subgrave traduce la fuerza telúrica (VEI) y un pulso cardíaco rítmico traduce la cantidad de personas amenazadas en la zona de evacuación."),
        ("5. Ficha de Detalles a Demanda: ", "La tarjeta inferior despliega simultáneamente las cuatro barras horizontales de población (5 km, 10 km, 30 km y 100 km), permitiendo comparar la progresión del riesgo de un solo vistazo.")
    ]
    for pref, text in items_flujo:
        p_it = doc.add_paragraph(style='List Bullet')
        r_b = p_it.add_run(pref)
        r_b.bold = True
        p_it.add_run(text)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # =========================================================================
    # SECCIÓN 3: EXPLICACIÓN FUNCIÓN POR FUNCIÓN (CÓDIGO)
    # =========================================================================
    h3 = doc.add_heading(level=1)
    r_h3 = h3.add_run("3. Explicación y Justificación de las Funciones del Código")
    r_h3.font.color.rgb = COLOR_PRIMARY

    funcs = [
        ("initVisualization()", 
         "Inicializa el lienzo SVG y la proyección cartográfica d3.geoNaturalEarth1().rotate([-150, 0]).",
         "Por qué: Los mapas occidentales tradicionales centran el meridiano 0°, lo que corta el Océano Pacífico por la mitad y divide el Cinturón de Fuego en dos fragmentos opuestos. Al rotar la proyección a -150° longitud, el Anillo de Fuego queda en el centro protagónico y continuo."),
        ("updateVolcanoMarks()",
         "Ordena los volcanes de mayor a menor tamaño (Z-Index descendente) y los renderiza usando d3.scaleSequential(d3.interpolateYlOrRd) para el VEI y Math.log10(pop_10km) para la población.",
         "Por qué: Resuelve el problema de oclusión (overplotting). Al dibujar los círculos grandes en el fondo y los pequeños encima, ningún volcán pequeño queda tapado en zonas densas como Japón o Indonesia."),
        ("triggerConcentricWaves(d)",
         "Genera una secuencia de ondas concéntricas animadas en color magma que irradian hacia afuera desde el volcán seleccionado y se desvanecen suavemente.",
         "Por qué: Proporciona la dimensión visual del impacto expansivo y sísmico sincronizada en tiempo real con el estruendo acústico de Tone.js, eliminando textos estáticos innecesarios en el mapa."),
        ("onVolcanoHover() & onVolcanoLeave()",
         "Resalta la marca y muestra el tooltip previo únicamente en volcanes no seleccionados; si el volcán ya está seleccionado, el tooltip flotante se suprime.",
         "Por qué: Evita la duplicación redundante de información. Como los datos del volcán seleccionado ya están en la ficha inferior, el tooltip se suprime para no tapar el cráter ni la onda expansiva."),
        ("onVolcanoSelect(d)",
         "Oculta de inmediato el hover flotante, centra la cámara suavemente en el cráter, dispara la onda expansiva animada, actualiza la ficha técnica y reproduce el audio.",
         "Por qué: Limpieza absoluta del lienzo interactivo. Al hacer clic, toda la atención se transfiere a la respuesta auditiva, la onda expansiva y la ficha inferior, eliminando textos flotantes superpuestos."),
        ("renderInspectorCard(d)",
         "Actualiza la ficha informativa con el nombre del volcán, país y sus dos métricas esenciales: Explosividad (VEI) y Población en zona de evacuación (10 km).",
         "Por qué: Aplica el principio de Tufte de máxima densidad de datos y mínimo ruido visual. Se eliminaron barras y tablas saturadas para concentrar toda la atención en la comparación directa entre fuerza geológica y exposición humana."),
        ("VolcanoAudioEngine.sonifyVolcano(volcano, 'pop_10km')",
         "Sintetiza un tono subgrave FM para el VEI (32 Hz a 73 Hz) y un pulso cardíaco rítmico cuyo tempo (48 a 165 BPM) es proporcional a la población en la zona de evacuación.",
         "Por qué: Cumple el principio de sonificación no trivial del curso: el sonido no depende solo del volumen, sino de la frecuencia fundamental (gravedad física) y del ritmo cardíaco (urgencia humana)."),
        ("setupAudioVisualizer()",
         "Lee el Tone.Analyser en cada fotograma y dibuja la forma de onda en un canvas de la interfaz.",
         "Por qué: Conecta la vista con el oído; proporciona confirmación visual de que el sistema de audio está activo y reaccionando a los datos.")
    ]

    for fname, desc, por_que in funcs:
        p_fn = doc.add_paragraph()
        r_fn = p_fn.add_run(f"• Función: {fname}\n")
        r_fn.bold = True
        r_fn.font.color.rgb = COLOR_SECONDARY
        p_fn.add_run(f"  Descripción: {desc}\n")
        r_pq = p_fn.add_run(f"  Justificación técnica y perceptual: {por_que}")
        r_pq.font.italic = True
        p_fn.paragraph_format.space_after = Pt(8)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # =========================================================================
    # SECCIÓN 4: CONEXIÓN CON LAS CÁPSULAS DEL CURSO
    # =========================================================================
    h4 = doc.add_heading(level=1)
    r_h4 = h4.add_run("4. Conexión Teórica con las Cápsulas del Curso (InfoVis PUC)")
    r_h4.font.color.rgb = COLOR_PRIMARY

    caps = [
        ("Cápsula 17 — «La Pregunta Antes del Gráfico»", 
         "El diseño no partió eligiendo un gráfico al azar. Se formuló una pregunta precisa de investigación: ¿Qué volcanes combinan explosividad con cercanía humana extrema? Todo el diseño está subordinado a responderla."),
        ("Cápsula 22 — «El Mantra de Shneiderman»", 
         "Estructura en tres niveles: (1) Overview First: mapa global continuo con círculos proporcionales a 10 km; (2) Zoom & Filter: controles de zoom suave y arrastre; (3) Details on Demand: ficha técnica y anillos concéntricos al seleccionar."),
        ("Cápsula 09 — «Escalar el Área, No el Radio»", 
         "Al representar la población mediante círculos, se aplicó una escala de área (raíz/logaritmo). Si se escala el radio linealmente, el área percibida se multiplica al cuadrado, induciendo un grave error de estimación perceptual."),
        ("Cápsula 10 — «El Color y Daltonismo»", 
         "Se seleccionó una rampa secuencial térmica (YlOrRd). Al ser el VEI una variable cuantitativa ordenada, requiere variación continua de luminosidad y saturación. Esta escala es distinguible para daltónicos rojo-verde (deuteranopía y protanopía)."),
        ("Cápsula 15 — «Sistemas de Coordenadas»", 
         "La rotación longitudinal a -150° adapta el sistema cartesiano a la geometría real del fenómeno natural, evitando el sesgo eurocéntrico que fractura el Océano Pacífico."),
        ("Cápsula 19 — «Bórralo: Menos es Más (Data-Ink Ratio)»", 
         "Siguiendo el principio de Edward Tufte, se eliminaron textos decorativos, leyendas verbosas, selectores redundantes y botones de perímetro superfluos. Prácticamente el 100% de los píxeles activos comunican datos."),
        ("Cápsula 23 — «Sonificación con Tone.js: Visualizar También se Escucha»", 
         "El sonido no es un adorno: codifica datos mediante tono (pitch) y tempo (BPM). Como enfatiza la cátedra, un sonido no debe depender del volumen para transmitir magnitud."),
        ("Cápsula 11 — «Iterar: El Ciclo de Diseño»", 
         "El proyecto no se quedó en su primera versión. Evolucionó desde una pantalla dividida con botones discretos hacia un lienzo unificado con anillos geográficos a escala real, respaldado por un rationale documentado.")
    ]

    for c_title, c_desc in caps:
        p_c = doc.add_paragraph(style='List Bullet')
        r_ct = p_c.add_run(f"{c_title}: ")
        r_ct.bold = True
        p_c.add_run(c_desc)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # =========================================================================
    # SECCIÓN 5: RATIONALE DE DISEÑO (QUÉ SE DESCARTÓ Y POR QUÉ)
    # =========================================================================
    h5 = doc.add_heading(level=1)
    r_h5 = h5.add_run("5. Rationale de Diseño: Decisiones y Descarte de Alternativas")
    r_h5.font.color.rgb = COLOR_PRIMARY

    p5 = doc.add_paragraph(
        "Uno de los puntos más valorados en la pauta de evaluación de la Entrega 1 es la justificación de qué alternativas se descartaron y por qué. "
        "A continuación se detallan los descartes realizados durante el ciclo de diseño:"
    )

    descartes = [
        ("Descarte de la pantalla dividida (Scatter Plot independiente)",
         "Alternativa inicial: Un mapa a la izquierda y un gráfico de dispersión (VEI vs. Población) a la derecha.\n"
         "Por qué se descartó: Dividía la atención visual del observador entre dos marcos inconexos. Se comprobó que el mapa en pantalla completa, enriquecido con la codificación dual (color para VEI y tamaño para población), transmitía el mensaje analítico con mucha mayor contundencia y sin dispersión cognitiva."),
        ("Descarte de los botones de perímetro (5 km, 10 km, 30 km, 100 km)",
         "Alternativa inicial: Una barra superior con cuatro botones segmentados para alternar el tamaño de los círculos.\n"
         "Por qué se descartó: Obligaba al usuario a depender de su memoria de trabajo (recordar cómo se veía un volcán a 5 km mientras miraba a 100 km). En vulcanología, el radio de 10 km es el límite internacional de evacuación inmediata. Fijar la vista en 10 km permite evaluar la amenaza letal directa sin clics ciegos."),
        ("Descarte de tablas y barras de progreso complejas en la esquina inferior",
         "Alternativa inicial: Una tabla con cuatro barras de progreso horizontales por radio, elevación y recuento de erupciones.\n"
         "Por qué se descartó: Constituía ruido visual periférico (chartjunk) que competía con la atención del mapa. Se simplificó a una ficha esencial con dos insignias contrastadas: Explosividad (VEI) y Población en zona de evacuación (10 km). Todo lo superfluo fue eliminado para maximizar el Data-Ink Ratio."),
        ("Solución al problema de superposición de volcanes (Overplotting)",
         "Problema detectado: En zonas de alta concentración (Indonesia, Japón, Centroamérica), los círculos de volcanes grandes tapaban a volcanes contiguos más pequeños.\n"
         "Solución implementada: Se implementó ordenamiento inteligente descendente por población con .order() en D3 (los círculos mayores se renderizan al fondo y los pequeños al frente en el DOM), combinado con una leve transparencia alfa (0.72) y un borde oscuro definido (0.85px), garantizando que ningún cráter quede oculto o inaccesible."),
        ("Descarte de menús de región, buscador de texto y etiquetas fijas de mapa",
         "Alternativa inicial: Selectores de continentes, campo de búsqueda y textos geográficos fijos flotando en el mapa.\n"
         "Por qué se descartó: Las etiquetas fijas colisionaban entre sí y los menús restaban superficie al mapa. Dado que el mapa cuenta con navegación libre fluida (pan/zoom) y onda expansiva animada al hacer clic, el usuario explora con máxima limpieza visual."),
        ("Inclusión de controles explícitos de zoom (+, −, ⟲)",
         "Por qué se incorporó: No todos los usuarios utilizan mouse con rueda o gestos multitáctiles. Incorporar botones flotantes compactos en la esquina superior derecha asegura accesibilidad universal y permite regresar instantáneamente a la vista general (Overview)."),
        ("Descarte del botón flotante de volumen (Sonificación transparente)",
         "Alternativa inicial: Un botón HUD en la esquina superior con ícono de altavoz y un osciloscopio en miniatura.\n"
         "Por qué se descartó: El sonido en este proyecto no es una opción estética secundaria o un reproductor musical, sino un canal perceptual directo codificado con los datos. Al eliminar el botón visual de volumen, la sonificación se integra de manera transparente y automática al hacer clic en cualquier volcán, reduciendo el ruido de interfaz a cero.")
    ]

    for d_title, d_text in descartes:
        p_d = doc.add_paragraph()
        r_dt = p_d.add_run(f"• {d_title}\n")
        r_dt.bold = True
        r_dt.font.color.rgb = COLOR_SECONDARY
        p_d.add_run(d_text)
        p_d.paragraph_format.space_after = Pt(8)

    doc.add_paragraph().paragraph_format.space_after = Pt(10)

    # =========================================================================
    # SECCIÓN 6: TABLA DE SÍNTESIS
    # =========================================================================
    h6 = doc.add_heading(level=1)
    r_h6 = h6.add_run("6. Tabla de Síntesis para el Informe de Entrega 1")
    r_h6.font.color.rgb = COLOR_PRIMARY

    tbl_data = [
        ["Dimensión de Diseño", "Elección Final Implementada", "Justificación Teórica (InfoVis)"],
        ["Pregunta Central", "¿Fuerza geológica (VEI) o cercanía humana?", "Cápsula 17: La visualización empieza por la pregunta, no por el gráfico."],
        ["Sistema Coordenado", "Natural Earth rotada a -150°", "Cápsula 15: Mantiene el Cinturón de Fuego continuo en el centro del encuadre."],
        ["Tamaño de Marca", "Área proporcional a población a 10 km", "Cápsula 09: Escalamiento por área; estándar internacional de evacuación."],
        ["Color de Marca", "Gradiente secuencial de calor (YlOrRd)", "Cápsula 10: Variable cuantitativa ordenada; accesible para daltonismo."],
        ["Perímetros Físicos", "4 anillos concéntricos geográficos en clic", "Cápsula 19: Elimina memoria de trabajo; comparación directa en un solo acto."],
        ["Sonificación", "Subgrave para VEI + Ritmo para población", "Cápsula 23: Sonificación con parámetros reales (tono + tempo), no solo volumen."],
        ["Arquitectura UI", "Lienzo único inmersivo con HUD flotante", "Cápsula 19: Maximización del Data-Ink Ratio de Edward Tufte."]
    ]

    tbl = doc.add_table(rows=len(tbl_data), cols=3)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    for r_idx, row in enumerate(tbl_data):
        for c_idx, val in enumerate(row):
            cell = tbl.cell(r_idx, c_idx)
            cell.text = val
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            if r_idx == 0:
                set_cell_background(cell, "333333")
                p_hdr = cell.paragraphs[0]
                p_hdr.runs[0].font.bold = True
                p_hdr.runs[0].font.color.rgb = RGBColor(255, 255, 255)
                p_hdr.runs[0].font.size = Pt(9)
            else:
                p_b = cell.paragraphs[0]
                p_b.runs[0].font.size = Pt(8.5)
                if r_idx % 2 == 1:
                    set_cell_background(cell, "F9F9F9")

    doc.add_paragraph().paragraph_format.space_after = Pt(14)

    # =========================================================================
    # SECCIÓN 7: PROYECCIÓN A LA ENTREGA 2 (FISICALIZACIÓN)
    # =========================================================================
    h7 = doc.add_heading(level=1)
    r_h7 = h7.add_run("7. Proyección hacia la Entrega 2 (Fisicalización con Protobject)")
    r_h7.font.color.rgb = COLOR_PRIMARY

    p7 = doc.add_paragraph(
        "El diseño actual proyecta una transición natural y directa hacia la Entrega 2 (visualización física, interactiva y sonora):\n"
        "• El cono volcánico en cartón: Se puede construir una maqueta física de un cono volcánico cortado por capas concéntricas "
        "(curvas de nivel) correspondientes a 5, 10, 30 y 100 km, utilizando las planillas del Physical Viz Toolkit.\n"
        "• Interacción tangible con Protobject: El smartphone del usuario se acopla en la base del volcán físico. Al deslizar un cursor o "
        "manipular una perilla de cartón que expande el radio de evacuación, el acelerómetro o sensor táctil del teléfono detecta el movimiento, "
        "disparando la vibración háptica con la intensidad del sismo y reproduciendo los latidos cardíacos en el parlante del celular."
    )

    # Guardar documento con manejo de bloqueo de archivo si Word lo tiene abierto
    filename = "Explicacion_Diseno_InfoVis_Volcanes.docx"
    try:
        doc.save(filename)
        print(f"Documento Word guardado exitosamente como: {filename}")
    except PermissionError:
        alt_filename = "Explicacion_Diseno_InfoVis_Volcanes_Actualizado.docx"
        doc.save(alt_filename)
        print(f"El archivo original estaba abierto en Word. Se guardó exitosamente como: {alt_filename}")

if __name__ == '__main__':
    create_document()
