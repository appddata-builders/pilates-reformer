/**
 * Texto de "Políticas, términos y condiciones" de Studio 57 (mismo contenido que
 * el PDF en public/assets/docs). Se muestra en el registro antes de aceptar.
 * Si cambia el documento, actualiza aquí y reemplaza el PDF.
 */

export type StudioPolicySection = {
  title: string
  items: string[]
}

export const STUDIO_POLICIES_TITLE = "Políticas, términos y condiciones"
export const STUDIO_POLICIES_SUBTITLE =
  "Reglamento para registro, reservaciones y uso de instalaciones"
export const STUDIO_POLICIES_VERSION = "Versión: 15/01/2026 · Sucursal: Lázaro Cárdenas"

export const STUDIO_POLICIES_INTRO =
  "Bienvenido(a) a Studio 57 Pilates Reformer. Nuestro propósito es ofrecer un espacio seguro, respetuoso y profesional para disfrutar del movimiento. Te invitamos a conocer las siguientes políticas antes de crear tu cuenta y reservar clases."

export const STUDIO_POLICY_SECTIONS: StudioPolicySection[] = [
  {
    title: "1. Registro y cuenta personal",
    items: [
      "Para reservar clases, cada alumno deberá crear una cuenta personal en el sitio web del estudio y proporcionar información veraz y actualizada.",
      "La cuenta es de uso personal. El alumno deberá mantener sus datos de contacto actualizados y cuidar sus credenciales de acceso.",
      "Antes de concluir su registro, el alumno deberá leer y aceptar estas políticas y el aviso de privacidad correspondiente.",
    ],
  },
  {
    title: "2. Compra de paquetes y pagos",
    items: [
      "Para confirmar la reservación de un paquete o clase, se requiere pagar el 50% de su costo total y enviar el comprobante de transferencia por WhatsApp al 753-130-4624.",
      "El 50% restante deberá liquidarse durante la primera clase correspondiente al paquete adquirido.",
      "La confirmación de espacios está sujeta a disponibilidad. Los precios, promociones, vigencias y condiciones particulares de cada paquete se mostrarán antes de finalizar la compra.",
      "Los pagos y comprobantes se gestionarán por los medios autorizados e informados por Studio 57.",
    ],
  },
  {
    title: "3. Reservaciones, cancelaciones y reprogramaciones",
    items: [
      "Las reservaciones, cancelaciones y reprogramaciones de clases deberán realizarse a través del sitio web de Studio 57.",
      "Para cancelar o reprogramar una clase, es necesario hacerlo con un mínimo de 6 horas de anticipación respecto a la hora de inicio de la clase.",
      "Sabemos que pueden surgir imprevistos. Sin embargo, para respetar el tiempo de nuestros instructores y permitir que otras personas aprovechen el espacio, las clases que no se cancelen o reprogramen con al menos 6 horas de anticipación se considerarán utilizadas y se descontarán del paquete correspondiente.",
      "La misma condición aplica cuando el alumno no asiste a una clase reservada y no realiza la cancelación o reprogramación dentro del plazo establecido.",
      "Las reprogramaciones están sujetas a la disponibilidad de lugares y a la vigencia del paquete contratado.",
    ],
  },
  {
    title: "4. Puntualidad y asistencia",
    items: [
      "Te recomendamos llegar de 5 a 10 minutos antes de tu clase para prepararte sin interrumpir la sesión.",
      "Por seguridad, el acceso después de iniciada la clase quedará sujeto a la valoración del instructor, especialmente cuando se haya perdido el calentamiento o las indicaciones iniciales.",
      "Cada alumno deberá seguir las instrucciones del personal durante su práctica.",
    ],
  },
  {
    title: "5. Área de espera y convivencia",
    items: [
      "Las personas que permanezcan en el área de espera, incluidos acompañantes, deberán guardar silencio o mantener la voz muy baja para no interrumpir la clase en curso.",
      "Los teléfonos deberán permanecer en modo silencio; las llamadas y conversaciones deberán realizarse fuera del área de práctica y sin perturbar las sesiones.",
      "Solicitamos mantener un trato amable y respetuoso hacia alumnos, instructores y personal del estudio.",
      "Los acompañantes deberán permanecer en las áreas permitidas y respetar las indicaciones del personal.",
    ],
  },
  {
    title: "6. Higiene y cuidado de instalaciones",
    items: [
      "Es obligatorio usar calcetines antideslizantes durante las clases de Reformer, por higiene y seguridad.",
      "Se solicita asistir con ropa cómoda y adecuada para realizar ejercicio, así como cuidar la limpieza del equipo y del espacio.",
      "No se permite ingresar alimentos a la zona de entrenamiento. Las bebidas deberán permanecer en recipientes cerrados y en las áreas indicadas.",
      "El equipo deberá utilizarse únicamente bajo las indicaciones del instructor. Cualquier desperfecto deberá reportarse al personal.",
    ],
  },
  {
    title: "7. Salud y seguridad durante la práctica",
    items: [
      "Antes de iniciar, informa al instructor sobre lesiones, embarazo, cirugías recientes, limitaciones físicas o cualquier situación de salud que pueda requerir adaptaciones durante el ejercicio.",
      "Cada alumno debe respetar sus límites y avisar de inmediato si experimenta dolor, mareo o malestar durante la clase.",
      "Las clases no sustituyen una valoración o tratamiento médico. Cuando corresponda, se recomienda consultar a un profesional de salud antes de participar.",
      "El estudio podrá sugerir modificaciones o suspender la participación en una actividad si identifica un riesgo inmediato para la seguridad del alumno.",
    ],
  },
  {
    title: "8. Cambios y cancelaciones por parte del estudio",
    items: [
      "Cuando Studio 57 deba cancelar una clase por causas operativas, se informará a los alumnos por los medios de contacto registrados tan pronto como sea posible.",
      "Las clases canceladas por el estudio no se descontarán como utilizadas. Se ofrecerá una alternativa de reprogramación o la solución que corresponda según el servicio contratado y la legislación aplicable.",
    ],
  },
  {
    title: "9. Vigencia, reembolsos y promociones",
    items: [
      "La vigencia y el número de clases de cada paquete se informarán de forma clara antes de la compra.",
      "Las condiciones de promociones, descuentos, transferencias y solicitudes de devolución se comunicarán antes de contratar y se aplicarán respetando los derechos que correspondan a los consumidores.",
      "Para dudas sobre saldos, pagos o solicitudes especiales, comunícate al 753-130-4624 o a studio57pilatesreformer@gmail.com.",
    ],
  },
  {
    title: "10. Aceptación de políticas",
    items: [
      "Al crear una cuenta y marcar la casilla de aceptación, el usuario confirma que ha tenido oportunidad de leer y comprender las presentes políticas.",
    ],
  },
]
