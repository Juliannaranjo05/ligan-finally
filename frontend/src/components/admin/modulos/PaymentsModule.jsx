import React, { useState, useEffect } from "react";
import {
  CreditCard,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  Building2,
  Smartphone,
  Globe,
  Shield,
  ShieldCheck
} from "lucide-react";
import { paymentsAdminApi, adminUtils } from "../../../services/adminApiService";

// Helper para obtener información del método de pago
const getPaymentMethodInfo = (method) => {
  const methods = {
    bancolombia: { name: 'Bancolombia', icon: Building2, color: 'text-yellow-400' },
    nequi: { name: 'Nequi', icon: Smartphone, color: 'text-purple-400' },
    payoneer: { name: 'Payoneer', icon: Globe, color: 'text-orange-400' },
    trc20: { name: 'TRC-20 (USDT)', icon: DollarSign, color: 'text-green-400' }
  };
  return methods[method] || { name: method || 'No configurado', icon: CreditCard, color: 'text-gray-400' };
};

const PaymentsModule = () => {
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  
  // Estados para datos
  const [pendingPayments, setPendingPayments] = useState([]);
  const [stats, setStats] = useState({
    pending: {
      total_amount: 0,
      count: 0,
      models_affected: 0
    },
    paid: {
      total_amount: 0,
      count: 0,
      this_week: 0,
      this_month: 0
    }
  });

  // Modal para marcar como pagado
  const [modalMarkPaid, setModalMarkPaid] = useState({
    isOpen: false,
    saving: false,
    payment: null,
    form: {
      payment_method: '',
      payment_reference: ''
    }
  });

  // Cargar datos al montar el componente
  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    setLoading(true);
    setStatsLoading(true);
    setError(null);
    
    try {
      const [paymentsData, statsData] = await Promise.all([
        paymentsAdminApi.getPendingPayments(),
        paymentsAdminApi.getStats()
      ]);

      if (paymentsData.success) {
        setPendingPayments(paymentsData.data || []);
      }

      if (statsData.success) {
        setStats(statsData.data);
      }

    } catch (error) {
      setError(adminUtils.manejarError(error));
    } finally {
      setLoading(false);
      setStatsLoading(false);
    }
  };

  const handleMarkAsPaid = (payment) => {
    // Pre-llenar el método de pago con el configurado por la modelo
    const methodInfo = getPaymentMethodInfo(payment.payment_method);
    setModalMarkPaid({
      isOpen: true,
      saving: false,
      payment: payment,
      form: {
        payment_method: methodInfo.name || '',
        payment_reference: ''
      }
    });
  };

  const handleSaveMarkAsPaid = async () => {
    if (!modalMarkPaid.form.payment_method.trim()) {
      alert('⚠️ Por favor ingresa el método de pago');
      return;
    }

    setModalMarkPaid(prev => ({ ...prev, saving: true }));

    try {
      const response = await paymentsAdminApi.markAsPaid(
        modalMarkPaid.payment.id,
        modalMarkPaid.form.payment_method,
        modalMarkPaid.form.payment_reference,
        modalMarkPaid.payment.model_user_id // Enviar model_user_id por si necesita crear el WeeklyPayment
      );

      if (response.success) {
        alert('✅ Pago marcado como pagado correctamente');
        setModalMarkPaid({ isOpen: false, saving: false, payment: null, form: { payment_method: '', payment_reference: '' } });
        cargarDatos(); // Recargar datos
      }
    } catch (error) {
      alert(`❌ Error: ${adminUtils.manejarError(error)}`);
    } finally {
      setModalMarkPaid(prev => ({ ...prev, saving: false }));
    }
  };

  // Filtrar pagos según búsqueda
  const filteredPayments = pendingPayments.filter(payment => {
    const matchesSearch = 
      payment.model_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      payment.model_email?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  if (loading && statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
        <span className="ml-3 text-gray-400">Cargando pagos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-yellow-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Pagos Pendientes</p>
              <p className="text-2xl font-bold text-yellow-300">${stats.pending.total_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
              <p className="text-red-400 text-xs mt-1">{stats.pending.count} pagos</p>
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <Clock className="w-8 h-8 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-green-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Total Pagado</p>
              <p className="text-2xl font-bold text-green-300">${stats.paid.total_amount.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
              <p className="text-green-400 text-xs mt-1">{stats.paid.count} pagos</p>
            </div>
            <div className="p-3 bg-green-500/20 rounded-lg">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-blue-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Esta Semana</p>
              <p className="text-2xl font-bold text-blue-300">${stats.paid.this_week.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
              <p className="text-gray-400 text-xs mt-1">Pagos procesados</p>
            </div>
            <div className="p-3 bg-blue-500/20 rounded-lg">
              <Calendar className="w-8 h-8 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-6 rounded-xl shadow-lg border border-purple-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-gray-400 text-sm">Este Mes</p>
              <p className="text-2xl font-bold text-purple-300">${stats.paid.this_month.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</p>
              <p className="text-gray-400 text-xs mt-1">Total mensual</p>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-lg">
              <TrendingUp className="w-8 h-8 text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
          <button 
            onClick={cargarDatos}
            className="ml-auto text-red-300 hover:text-red-200"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pagos Pendientes */}
      <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-yellow-500/20">
        <div className="p-6 border-b border-gray-700/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-lg font-semibold text-yellow-300 flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Pagos Pendientes
              <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded-full text-sm">
                {filteredPayments.length}
              </span>
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-auto">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  placeholder="Buscar por modelo..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-auto bg-gray-700/50 text-gray-300 pl-10 pr-4 py-2 rounded-lg border border-gray-600/50 placeholder-gray-500 focus:border-yellow-500/50 focus:outline-none text-sm"
                />
              </div>
              <button 
                onClick={cargarDatos}
                className="text-yellow-400 hover:text-yellow-300 p-2 rounded-lg hover:bg-yellow-500/10"
                title="Actualizar"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          {filteredPayments.length === 0 ? (
            <div className="text-center py-8">
              <CreditCard className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">
                {searchTerm ? 'No se encontraron pagos con ese criterio' : 'No hay pagos pendientes'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1200px]">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-700/50">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Modelo</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Información de Cuenta</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Período</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Monto Total</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Por Tiempo</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Por Regalos</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Sesiones</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Días Pendiente</th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-gray-700/30 hover:bg-gray-700/20">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-purple-600 rounded-full flex items-center justify-center">
                              <span className="text-white font-medium text-sm">
                                {payment.model_name?.charAt(0) || '?'}
                              </span>
                            </div>
                            <div>
                              <div className="text-gray-300 font-medium">{payment.model_name || 'Sin nombre'}</div>
                              <div className="text-gray-500 text-sm">{payment.model_email || 'Sin email'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          {payment.payment_method ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const methodInfo = getPaymentMethodInfo(payment.payment_method);
                                  const IconComponent = methodInfo.icon;
                                  return (
                                    <>
                                      <IconComponent className={`w-4 h-4 ${methodInfo.color}`} />
                                      <span className={`text-sm font-medium ${methodInfo.color}`}>
                                        {methodInfo.name}
                                      </span>
                                      {payment.payment_method_verified ? (
                                        <ShieldCheck className="w-3 h-3 text-green-400" title="Verificado" />
                                      ) : (
                                        <AlertCircle className="w-3 h-3 text-yellow-400" title="No verificado" />
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                              {payment.account_holder_name && (
                                <div className="text-xs text-gray-400">
                                  Titular: {payment.account_holder_name}
                                </div>
                              )}
                              {payment.account_details && (
                                <div className="text-xs text-gray-500 font-mono">
                                  {payment.account_details}
                                </div>
                              )}
                              {payment.country_name && (
                                <div className="text-xs text-gray-500">
                                  {payment.country_name}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-gray-500 text-sm">
                              <AlertCircle className="w-4 h-4" />
                              <span>Sin cuenta configurada</span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-4 text-gray-300">{payment.week_range || 'N/A'}</td>
                        <td className="py-4 px-4">
                          <span className="text-yellow-300 font-semibold">
                            ${payment.amount?.toLocaleString('es-ES', { minimumFractionDigits: 2 }) || '0.00'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-gray-400">
                          ${payment.time_earnings?.toLocaleString('es-ES', { minimumFractionDigits: 2 }) || '0.00'}
                        </td>
                        <td className="py-4 px-4 text-gray-400">
                          ${payment.gift_earnings?.toLocaleString('es-ES', { minimumFractionDigits: 2 }) || '0.00'}
                        </td>
                        <td className="py-4 px-4 text-gray-400">{payment.total_sessions || 0}</td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            payment.days_pending > 7 ? 'bg-red-500/20 text-red-400' :
                            payment.days_pending > 3 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {payment.days_pending || 0} días
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <button 
                            onClick={() => handleMarkAsPaid(payment)}
                            className="bg-green-500/20 text-green-400 px-3 py-1 rounded-lg text-sm hover:bg-green-500/30 transition-colors flex items-center gap-1"
                          >
                            <CheckCircle className="w-3 h-3" />
                            Marcar como Pagado
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal para marcar como pagado */}
      {modalMarkPaid.isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-lg w-full mx-4">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-400" />
                Marcar Pago como Pagado
              </h3>
              {modalMarkPaid.payment && (
                <p className="text-gray-400 text-sm mt-2">
                  Modelo: <span className="text-pink-300">{modalMarkPaid.payment.model_name}</span> - 
                  Monto: <span className="text-yellow-300">${modalMarkPaid.payment.amount?.toLocaleString('es-ES', { minimumFractionDigits: 2 })}</span>
                </p>
              )}
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">
                  Método de Pago <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={modalMarkPaid.form.payment_method}
                  onChange={(e) => setModalMarkPaid(prev => ({
                    ...prev,
                    form: { ...prev.form, payment_method: e.target.value }
                  }))}
                  className="w-full bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg border border-gray-600/50 focus:border-green-500/50 focus:outline-none"
                  placeholder="Ej: Transferencia bancaria, PayPal, etc."
                />
              </div>
              <div>
                <label className="block text-gray-400 text-sm font-medium mb-2">
                  Referencia de Pago (opcional)
                </label>
                <input
                  type="text"
                  value={modalMarkPaid.form.payment_reference}
                  onChange={(e) => setModalMarkPaid(prev => ({
                    ...prev,
                    form: { ...prev.form, payment_reference: e.target.value }
                  }))}
                  className="w-full bg-gray-700/50 text-gray-300 px-3 py-2 rounded-lg border border-gray-600/50 focus:border-green-500/50 focus:outline-none"
                  placeholder="Ej: Número de transacción, referencia, etc."
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setModalMarkPaid({ isOpen: false, saving: false, payment: null, form: { payment_method: '', payment_reference: '' } })}
                disabled={modalMarkPaid.saving}
                className="px-4 py-2 text-gray-400 hover:text-gray-300 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveMarkAsPaid}
                disabled={modalMarkPaid.saving}
                className="bg-green-500/20 text-green-400 px-6 py-2 rounded-lg hover:bg-green-500/30 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {modalMarkPaid.saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Marcar como Pagado
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsModule;
