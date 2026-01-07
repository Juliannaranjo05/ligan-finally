import React, { useEffect, useRef } from "react";

/**
 * Componente para mostrar el botón de pago de Wompi usando el widget oficial.
 * Props requeridas:
 * - publicKey: llave pública de Wompi
 * - currency: moneda (COP)
 * - amountInCents: monto en centavos
 * - reference: referencia única
 * - signature:integrity: firma SHA256
 * - redirectUrl: URL de retorno tras el pago
 */
export default function WompiWidgetButton({
  publicKey,
  currency = "COP",
  amountInCents,
  reference,
  signature,
  redirectUrl
}) {
  const widgetRef = useRef(null);

  useEffect(() => {
    // Cargar el script de Wompi solo una vez
    if (!document.getElementById("wompi-widget-js")) {
      const script = document.createElement("script");
      script.src = "https://checkout.wompi.co/widget.js";
      script.id = "wompi-widget-js";
      script.async = true;
      document.body.appendChild(script);
    }
  }, []);

  useEffect(() => {
    // Limpiar el contenedor antes de renderizar el nuevo botón
    if (widgetRef.current) {
      widgetRef.current.innerHTML = "";
      // Crear el <script> con los atributos requeridos
      const script = document.createElement("script");
      script.setAttribute("src", "https://checkout.wompi.co/widget.js");
      script.setAttribute("data-render", "button");
      script.setAttribute("data-public-key", publicKey);
      script.setAttribute("data-currency", currency);
      script.setAttribute("data-amount-in-cents", amountInCents);
      script.setAttribute("data-reference", reference);
      script.setAttribute("data-signature:integrity", signature);
      // Pasar redirectUrl si se provee para que Wompi muestre el botón de regreso/finalizar
      if (redirectUrl) {
        script.setAttribute("data-redirect-url", redirectUrl);
        script.setAttribute("data-cancel-url", redirectUrl);
      }
      widgetRef.current.appendChild(script);
    }
  }, [publicKey, currency, amountInCents, reference, signature, redirectUrl]);

  return (
    <div ref={widgetRef} />
  );
}
