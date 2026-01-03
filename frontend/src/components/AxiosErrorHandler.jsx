import React, { useEffect } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function AxiosErrorHandler() {
  useEffect(() => {
    const handler = (event) => {
      const { status, mensaje, codigo, url, method } = event.detail;

        status,
        mensaje,
        codigo,
        url,
        method,
      });

      toast.error(`⚠️ ${mensaje || "Error desconocido"} (${status})`, {
        position: "top-right",
        autoClose: 5000,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "dark",
      });
    };

    window.addEventListener("axiosError", handler);

    return () => {
      window.removeEventListener("axiosError", handler);
    };
  }, []);

  return null;
}
