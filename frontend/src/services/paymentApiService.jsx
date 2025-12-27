import axios from '../api/axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/**
 * Servicio para gestionar métodos de pago guardados
 */
export const paymentApiService = {
  /**
   * Obtener métodos de pago guardados del usuario
   */
  async getSavedPaymentMethods() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/payment-methods/saved`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo métodos de pago:', error);
      throw error;
    }
  },

  /**
   * Agregar nuevo método de pago
   */
  async addPaymentMethod(data) {
    try {
      const response = await axios.post(`${API_BASE_URL}/api/payment-methods`, data);
      return response.data;
    } catch (error) {
      console.error('Error agregando método de pago:', error);
      throw error;
    }
  },

  /**
   * Actualizar método de pago guardado
   */
  async updateSavedPaymentMethod(id, data) {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/payment-methods/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('Error actualizando método de pago:', error);
      throw error;
    }
  },

  /**
   * Eliminar método de pago
   */
  async deletePaymentMethod(id) {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/payment-methods/${id}`);
      return response.data;
    } catch (error) {
      console.error('Error eliminando método de pago:', error);
      throw error;
    }
  },

  /**
   * Obtener métodos de pago desde historial de compras
   */
  async getPaymentMethodsFromHistory() {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/payment-methods/from-history`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo métodos del historial:', error);
      throw error;
    }
  }
};

export default paymentApiService;


