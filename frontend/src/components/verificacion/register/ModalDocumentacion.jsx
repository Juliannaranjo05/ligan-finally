import React from "react";

export default function ModalDocumentacion({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1a1c20] rounded-2xl p-8 max-w-3xl w-full relative shadow-2xl border border-white/10 overflow-y-auto max-h-[80vh] custom-scrollbar">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <h2 className="text-white text-2xl font-bold">Documentación</h2>
          <button
            onClick={onClose}
            className="text-white/50 hover:text-white p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenido (ejemplo con scroll interno) */}
        <div className="text-white/80 text-sm space-y-6">
          <section>
            <h3 className="text-[#ff007a] font-semibold mb-2">Términos y Condiciones</h3>
            <p>
              LIGANDO – TÉRMINOS Y CONDICIONES DE USO (ACUERDO)
                Fecha de entrada en vigor: desde el 12 de agosto de 2025
                IMPORTANTE: LEA ATENTAMENTE: SU USO Y ACCESO AL SITIO WEB ligando.online, A LOS 
                PRODUCTOS, SERVICIOS, APLICACIÓN MÓVIL (SI CORRESPONDE) Y SOFTWARE ASOCIADO (EN 
                CONJUNTO, LOS "SERVICIOS") DE LA COMPAÑÍA Y SUS AFILIADOS ESTÁ SUJETO AL CUMPLIMIENTO
                Y ACEPTACIÓN DE ESTOS TÉRMINOS, QUE INCLUYEN SU ACUERDO CON EL ARBITRAJE DE 
                RECLAMACIONES. POR FAVOR, REVÍSELOS DETENIDAMENTE ANTES DE USAR LOS SERVICIOS.
                AL HACER CLIC/MARCAR EL BOTÓN/CASILLA DE VERIFICACIÓN "ACEPTO" O "REGISTRARSE" (O 
                REALIZAR ACCIONES SIMILARES), AL ACCEDER Y USAR EL SITIO WEB, O AL UTILIZAR LOS SERVICIOS 
                DE LA COMPAÑÍA, USTED ACEPTA ESTAR OBLIGADO POR ESTOS TÉRMINOS Y CONDICIONES DE 
                USO Y TODOS LOS ANEXOS Y POLÍTICAS INCORPORADAS (""). EL SITIO WEB Y LOS SERVICIOS NO 
                ESTÁN DISPONIBLES PARA PERSONAS QUE NO REÚNEN LOS REQUISITOS PARA ESTAR OBLIGADOS 
                POR ESTOS TÉRMINOS Y QUE NO LOS HAYAN FIRMADO.
                Dicha firma no necesita ser física, ya que la aceptación electrónica de este Acuerdo está permitida 
                por la Ley de Firmas Electrónicas en el Comercio Global y Nacional (Ley de Firma Electrónica), el 
                Reglamento (UE) n.º 910/2014 del Parlamento Europeo y del Consejo, de 23 de julio de 2014, y 
                leyes federales y estatales similares. COMO SE DESCRIBE ANTERIORMENTE, USTED MANIFIESTA SU
                ACEPTACIÓN DE ESTE ACUERDO CONTRACTUAL AL REALIZAR CUALQUIER ACTO QUE DEMUESTRE 
                SU CONSENTIMIENTO AL MISMO. DEBE ENTENDER QUE ESTO TIENE EL MISMO EFECTO LEGAL 
                QUE LA FIRMA FÍSICA EN CUALQUIER OTRO CONTRATO LEGAL.
                Si hace clic en cualquier enlace, botón u otro dispositivo que se le proporcione en cualquier parte 
                de la interfaz de Nuestro Sitio Web, entonces ha aceptado legalmente todos estos Términos. 
                Además, al utilizar cualquiera de nuestros sitios web o servicios de cualquier manera, usted 
                comprende y acepta que consideraremos dicho uso como su afirmación de su aceptación 
                completa e incondicional de todos los términos de este Acuerdo.
                Si busca información sobre alguna actividad ilegal, debe abandonar este sitio web inmediatamente
                y no intentar utilizar los Servicios.
                Usted acepta no utilizar los Servicios ni acceder al Sitio web si hacerlo violara las leyes de su 
                estado, provincia o país.
                La Compañía ofrece la posibilidad de utilizar sus Servicios en los siguientes términos y condiciones:
                DEFINICIONES
                "Chat" significa una sesión de comunicación y/o colaboraciones entre el Usuario y el Operador a 
                través del Sitio web y los Servicios, incluidos los servicios de audio, video y mensajería.
                "Cuenta de Usuario" se refiere a una cuenta de Usuario estándar, accesible tras el proceso de 
                registro, que permite al Usuario utilizar Nuestros Servicios según lo descrito en las Condiciones y 
                en el Sitio Web. Los Servicios pueden ser gratuitos o de pago.
                "Cuenta de Operador" se refiere a una cuenta especial de Operador creada por el Usuario, 
                accesible tras el proceso de registro y verificación descrito en este documento, que le permite 
                recibir Moneda Interna y realizar pagos (cambio de Moneda Interna a moneda fiduciaria) por 
                participar en los Chats. "Operador" se refiere al titular de la cuenta de Operador. La concesión de 
                la condición de Operador queda a discreción exclusiva de la Compañía, de acuerdo con las reglas 
                definidas en este Acuerdo.
                "Moneda Interna" se refiere a la moneda que solo se puede usar en el Sitio Web y los Servicios. 
                Existen dos tipos de Moneda Interna: minutos y compensación. Los Usuarios pueden comprar 
                minutos con moneda fiduciaria en el Sitio Web y los Servicios. Mientras el Usuario visualiza el 
                contenido de pago participando en el Chat, los minutos se convierten en compensación, que el 
                receptor (Operador) tiene derecho a canjear por moneda fiduciaria.
                "Propiedad intelectual de la empresa" significa todos y cada uno de los derechos de autor, 
                derechos exclusivos y otros derechos de propiedad intelectual sobre todo el contenido y otros 
                materiales incluidos en el Sitio web o proporcionados en relación con los Servicios, incluidos, entre
                otros, el nombre de la empresa, la marca registrada, el logotipo de la empresa y todos los diseños, 
                textos, gráficos, imágenes, información, datos, software, tecnologías, conocimientos técnicos, 
                otros archivos y las selecciones y arreglos de los mismos.
                "Usuario" o "Usted" se refiere a una persona física que utiliza Nuestros Servicios. Quienes visiten 
                el Sitio Web y los Servicios sin una cuenta, independientemente del tipo de cuenta creada, deben 
                cumplir estrictamente los términos y condiciones establecidos en estos Términos. Los requisitos 
                especiales para ciertos tipos de cuentas se definen en las cláusulas pertinentes de estos Términos 
                y deben ser respetados por los sujetos definidos.
                "Sitio web" se refiere a https://ligando.online, sus subdominios y todos los demás nombres de 
                dominio relacionados, operados por la Compañía (incluido ligando/home). El administrador y 
                gestor del Sitio web es la Compañía.
                PRIVACIDAD
                Respetamos su privacidad. El uso de los Servicios está sujeto a la Política de Privacidad de la 
                Compañía, disponible en esta URL: https://ligando.online/es/privacy. La Política de Privacidad se 
                incorpora a estos Términos por referencia.
                Servicios
                La naturaleza legal del Acuerdo es la de un contrato de licencia entre Usted y la Compañía, 
                mediante el cual la Compañía únicamente desarrolla, administra, gestiona y opera el Sitio Web, el 
                software y la plataforma para prestar los Servicios aquí descritos.
                La Compañía (licenciante) otorga al Usuario (licenciatario) un derecho limitado para usar el Sitio 
                Web, los Servicios y su software con el único fin de visualizar el contenido y participar en su 
                creación, permitiéndoles comunicarse con Operadores aleatorios durante una sesión de Chat 
                mediante funciones de mensajería, voz, video y audio.
                Funciones del Servicio:
                Servicio de audio: requiere micrófono funcional, operativo y correctamente configurado.
                Servicios de mensajería: requiere dispositivo apto para introducir textos.
                Servicio de vídeo: requiere cámara funcional (webcam u otra) correctamente configurada.
                Traductor automático: el sistema puede no garantizar traducción exacta.
                Regalos: pueden ser enviados con Moneda Interna; uso fraudulento puede acarrear sanciones.
                Favoritos: permite añadir Operadores a lista personal para ver disponibilidad.
                Evaluación del chat: permite calificación mutua entre usuarios.
                Condiciones adicionales:
                Los Servicios son para entretenimiento, recreación y diversión.
                No otorgan derechos de sublicencia ni permiten actuar en nombre de personas jurídicas.
                Es obligatorio crear una cuenta para iniciar un Chat.
                Puede existir un Período de Prueba gratuito según condiciones definidas por la Compañía.
                Tras el Período de Prueba, el uso es de pago según tarifas vigentes en el Sitio Web.
                Está prohibido compartir información sensible como claves, datos bancarios o contraseñas.
                Supervisión y seguridad:
                La Compañía puede registrar y almacenar comunicaciones, capturas de pantalla, instantáneas y 
                utilizar sistemas de IA o ML para verificación de identidad y prevención de fraude.
                ELEGIBILIDAD Y REGISTRO DE CUENTA
                Requisitos generales:
                Ser mayor de edad (18 o 21 años según jurisdicción).
                Tener capacidad legal y no estar bajo efectos de sustancias que alteren el juicio.
                Usar el sitio para fines personales y no comerciales.
                Cumplir con estos Términos y la Política de Privacidad.
                Cuenta de Usuario:
                Crear contraseña segura, no usada en otros sitios.
                Completar registro con información veraz.
                No utilizar nombres ofensivos, engañosos o con referencias prohibidas.
                Mantener seguridad del acceso y dispositivo utilizado.
                Cuenta de Operador:
                Solo para mujeres mayores de edad con capacidad legal.
                Proveer copia de documento de identidad y foto sosteniéndolo.
                Tener cámara siempre encendida durante el Chat.
                Aceptar y firmar electrónicamente el Acuerdo de Operador 
                REGLAS GENERALES DE COMPORTAMIENTO
                Está estrictamente prohibido:
                Realizar actividades ilegales o que infrinjan leyes aplicables.
                Permitir la aparición o participación de menores.
                Compartir contenido ilegal, abusivo, violento, sexualmente explícito o que atente contra la 
                dignidad humana.
                Participar en fraude, suplantación de identidad o dar información falsa.
                Modificar o intentar acceder al código fuente de los Servicios.
                Promover odio, violencia o discriminación.
                Proponer o aceptar medios de pago distintos a los autorizados.
                Invadir la privacidad de otros usuarios.
                Grabar o difundir interacciones sin consentimiento.
                Participar en actividades que perjudiquen la seguridad o estabilidad del servicio.
                COMUNICACIÓN PAGADA VÍA CHAT
                Tras el Período de Prueba, todo acceso será de pago.
                Tarifas, moneda interna (minutos) y comisiones estarán publicadas en el sitio.
                Opciones de pago:
                Suscripción (membresía): facturación automática, incluye minutos y funciones definidas.
                Compra única de minutos: para uso limitado.
                La moneda interna no tiene valor fuera de la plataforma y no puede venderse o transferirse.
                Reembolsos: solo aplicables si no se ha iniciado el uso del servicio o por fallos atribuibles a la 
                Compañía.
                DERECHOS DE AUTOR Y PROPIEDAD INTELECTUAL
                La Compañía conserva la titularidad de todo el contenido, software y marca.
                Se otorga licencia limitada, personal y no transferible para el uso de los Servicios.
                El Usuario conserva derechos sobre el contenido que crea, pero concede a la Compañía licencia 
                para uso con fines de marketing, publicidad y promoción.
                SIN GARANTÍAS
                El uso del servicio es bajo responsabilidad exclusiva del usuario.
                La Compañía no garantiza disponibilidad continua ni ausencia de fallos.
                No se asume responsabilidad por contenido de terceros o comportamiento de otros usuarios.
                TERMINACIÓN Y SANCIONES
                La Compañía podrá:
                Emitir advertencias.
                Suspender o cancelar cuentas.
                Eliminar contenido que infrinja las normas.
                Notificar a autoridades competentes.
                Cancelar cuentas inactivas por más de un año.
                El usuario puede solicitar eliminación de datos, lo que implica la terminación del Acuerdo y 
                pérdida de acceso a los Servicios.
                INDEMNIZACIÓN
                El Usuario indemnizará a la Compañía frente a reclamaciones por uso indebido de los Servicios o 
                incumplimiento de estos Términos.
                LIMITACIÓN DE RESPONSABILIDAD
                La responsabilidad máxima de la Compañía se limita a la cuota mensual pagada por el Usuario.
                No se responderá por daños indirectos, lucro cesante o pérdidas derivadas del uso o imposibilidad 
                de uso de los Servicios.
                COMUNICACIONES Y MARKETING
                El Usuario acepta recibir notificaciones y comunicaciones electrónicas.
                Puede cancelar suscripciones a comunicaciones comerciales, pero seguirá recibiendo avisos 
                esenciales del servicio.
                ENMIENDAS
                La Compañía puede modificar estos Términos publicando la versión actualizada en el sitio.
                El uso continuado implica aceptación de los cambios.
                LEY APLICABLE Y ARBITRAJE
                Este Acuerdo se rige por las leyes de la República de Chipre.
                Cualquier disputa se resolverá por arbitraje vinculante en Chipre, salvo excepciones legales.
                No se permiten demandas colectivas.
                MISCELÁNEAS
                Este Acuerdo reemplaza acuerdos previos.
                La falta de ejercicio de un derecho no implica renuncia al mismo.
                Si alguna disposición es inválida, las demás siguen vigentes.
                No se permite la cesión de derechos sin consentimiento escrito de la Compañía.
                Apéndice 1 – Acuerdo de Operador
                Define condiciones específicas para cuentas de Operador.
                Requiere mantener cámara encendida, cumplir normas y proporcionar contenido original.
                La Compañía puede suspender pagos en caso de infracciones
            </p>
          </section>

          <section>
            <h3 className="text-[#ff007a] font-semibold mb-2">Política de Privacidad</h3>
            <p>
              # **Política de Privacidad de LIGANDO**
                **Última actualización:** 12 de agosto de 2025
                Esta Política de Privacidad describe cómo **LIGANDO** (en adelante, la “Compañía”, “nosotros”, 
                “nuestro”) recopila, utiliza y protege la información personal de los usuarios (“Usuario” o “usted”) 
                cuando acceden y utilizan el sitio web **ligando.online** (el “Sitio Web”) y sus servicios 
                asociados.--
                ## **1. Alcance**
                Esta Política se aplica a toda la información personal recopilada a través del Sitio Web, 
                comunicaciones electrónicas y cualquier otro medio relacionado con el uso de nuestros servicios.--
                ## **2. Información personal que podemos recopilar**
                Al prestar nuestros servicios, podemos recopilar **Información Personal**, incluyendo:
                ### **2.1 Información necesaria para el registro**
                Cuando crea una cuenta de Usuario estándar en nuestro Sitio Web, podemos solicitar:
                * Dirección de correo electrónico (y estado de verificación).
                * Contraseña.
                * Nombre de usuario.
                * Nombre para mostrar (si aplica).
                * País, región y ciudad de residencia.
                * Fotografías (si aplica).
                * Género.
                * Idiomas que habla.
                * Intereses y preferencias (incluyendo fetiches, si aplica).
                Si utiliza un servicio de terceros para registrarse, también podemos recopilar la información que 
                usted proporcione a dicho tercero.
                ### **2.2 Información para cuentas de Operador**
                En caso de registrar una cuenta especial de Operador, podremos requerir:
                * Copia de documento de identidad válido.
                * Fotografía y características visuales.
                * Fecha de nacimiento y lugar de residencia.
                * Información de pagos, métodos y saldo.
                * Estado y proveedor de verificación de identidad.
                ### **2.3 Datos de contacto**
                Si se comunica con nosotros, podemos procesar:
                * Nombre.
                * Dirección.
                * Número de teléfono.
                * Correo electrónico.
                El suministro de estos datos es opcional.
                ### **2.4 Datos recopilados de forma pasiva**
                Incluyen:
                * Dirección IP.
                * Fecha y hora de última actividad.
                * Estado del Usuario y de la cuenta.
                * Historial de reportes.
                * ID de sala.
                * Cookies.
                * Capturas de pantalla de chats de video con fines de moderación.
                * Historial de navegación y búsqueda.
                ### **2.5 Datos de marketing**
                Información sobre su uso del Servicio: acciones, frecuencia, duración, calidad de conexión, 
                mensajes enviados, contactos, contenido compartido, chats, uso de video, reuniones, etc.
                ### **2.6 Información de mensajes**
                Contenido de mensajes de chat, remitentes, destinatarios, fecha, hora y confirmaciones de 
                lectura.
                ### **2.7 Información de pagos**
                Datos de transacciones: moneda, minutos, identificadores de usuario, valor, estado, facturas, 
                reembolsos, tipo de servicio adquirido.
                Para cuentas de Operador: datos de facturación, métodos de pago, errores de transacción.
                ### **2.8 Información de comunicaciones por video**
                Participantes, fecha, hora, duración y actividad.
                ### **2.9 Otra información voluntaria**
                Cualquier información adicional que decida compartir con nosotros.--
                ## **3. Política de No Menores de Edad**
                Nuestros servicios **no están destinados** a personas menores de dieciocho (18) años o veintiún 
                (21) años, según la mayoría de edad en su jurisdicción.
                No recopilamos deliberadamente datos de menores.--
                ## **4. Formas de recopilación de datos personales**
                Recopilamos datos cuando:
                * Visita o utiliza el Sitio Web.
                * Crea una cuenta.
                * Solicita asistencia.
                * Nos contacta por cualquier medio.
                * Interactúa con otros usuarios.
                También podemos recopilar información mediante **cookies**.--
                ## **5. Base legal y fines del tratamiento (Art. 6 GDPR)**
                ### **5.1 Cumplimiento de obligaciones legales**
                * Cumplir leyes aplicables.
                * Moderar contenido.
                * Verificar edad.
                * Conservar información fiscal y de pagos.
                * Responder a autoridades.
                ### **5.2 Ejecución de obligaciones contractuales**
                * Prestar servicios.
                * Proporcionar funciones de videochat y mensajería.
                * Mejorar el rendimiento del Sitio Web.
                * Enviar notificaciones de seguridad y cambios de servicio.
                ### **5.3 Intereses legítimos**
                * Prevenir fraudes.
                * Proteger a usuarios y sistemas.
                * Mejorar experiencia.
                * Publicidad personalizada.
                ### **5.4 Protección de intereses vitales**
                * Proteger vida o integridad física en emergencias.
                ### **5.5 Consentimiento**
                * Procesar información según su autorización explícita.
                * Puede retirarlo en cualquier momento.--
                ## **6. Tratamiento de categorías especiales (Art. 9 GDPR)**
                Podemos procesar datos sensibles, como:
                * Origen étnico.
                * Creencias religiosas.
                * Vida sexual u orientación sexual.
                * Datos biométricos o de salud.
                **Base legal:**
                * Consentimiento explícito.
                * Datos que usted haya hecho públicos.
                * Defensa de reclamaciones legales.--
                ## **7. Conservación de datos**
                Conservamos la información:
                * Mientras la cuenta esté activa o el contrato vigente.
                * Por el tiempo necesario para fines legales, fiscales o de defensa judicial.
                * Podremos retenerla por plazos adicionales si la ley lo exige.--
                ## **8. Compartir información**
                Podemos compartir su información con:
                * Autoridades competentes.
                * Proveedores de alojamiento.
                * Proveedores de verificación de identidad.
                * Procesadores de pagos.
                Todos los terceros deben proteger la información y usarla solo para prestar servicios.--
                ## **9. Medidas de seguridad**
                Usamos protocolos como **TLS** y medidas físicas, técnicas y administrativas para proteger 
                datos.
                No podemos garantizar seguridad absoluta ante accesos no autorizados.--
                ## **10. Cookies**
                Utilizamos cookies para:
                * Funcionamiento básico.
                * Rendimiento y análisis.
                * Publicidad y segmentación.
                Puede configurar su navegador para rechazarlas, aunque puede afectar la experiencia.--
                ## **11. Derechos del usuario**
                Usted puede:
                * Acceder, rectificar o eliminar sus datos.
                * Solicitar portabilidad.
                * Restringir el tratamiento.
                * Oponerse al tratamiento.
                * Presentar reclamaciones ante la autoridad competente.--
                ## **12. Cambios a la Política**
                Podemos modificar esta Política en cualquier momento.
                El uso continuo del Sitio implica aceptación de la versión actualizada.
                --
                ## **13. Contacto**
                Si tiene preguntas, contáctenos:
                📧 **[support@ligando.online](mailto:support@ligando.online)**
                🌐 **[www.ligando.online](http://www.ligando.online)**
                Contactanos :
                help@ligando.online
                report@ligando.online
                biling@ligando.online
                noreply@ligando.online
                corporative@ligando.online
                support@ligando.onlin
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}