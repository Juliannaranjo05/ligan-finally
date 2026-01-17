import React, { useEffect, useState } from "react";
import {
  Coins,
  TrendingUp,
  Wallet,
  Users,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Search,
  Filter,
  AlertTriangle,
} from "lucide-react";
import { coinsAdminApi, adminUtils } from "../../../services/adminApiService";

const CoinsModule = () => {
  const [stats, setStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState(null);

  const [transactions, setTransactions] = useState([]);
  const [transactionsPagination, setTransactionsPagination] = useState(null);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [transactionsError, setTransactionsError] = useState(null);

  const [usersBalance, setUsersBalance] = useState([]);
  const [usersBalancePagination, setUsersBalancePagination] = useState(null);
  const [loadingUsersBalance, setLoadingUsersBalance] = useState(true);
  const [usersBalanceError, setUsersBalanceError] = useState(null);

  const [transactionFilters, setTransactionFilters] = useState({
    type: "all",
    search: "",
    page: 1,
    per_page: 20,
  });

  const [usersFilters, setUsersFilters] = useState({
    rol: "all",
    search: "",
    balance_status: "all",
    page: 1,
    per_page: 10,
  });

  const [addingCoins, setAddingCoins] = useState(false);
  const [addCoinsModalOpen, setAddCoinsModalOpen] = useState(false);
  const [addCoinsForm, setAddCoinsForm] = useState({
    user_id: "",
    amount: "",
    type: "purchased",
    reference_id: "",
  });

  const [addCoinsError, setAddCoinsError] = useState(null);

  useEffect(() => {
    loadStats();
    loadTransactions();
    loadUsersBalance();
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [transactionFilters.type, transactionFilters.search, transactionFilters.page]);

  useEffect(() => {
    loadUsersBalance();
  }, [usersFilters.rol, usersFilters.search, usersFilters.balance_status, usersFilters.page]);

  const loadStats = async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const response = await coinsAdminApi.getStats({ days: 30 });
      if (response.success) {
        setStats(response.data);
      } else {
        setStatsError("No se pudieron cargar las estadísticas de monedas.");
      }
    } catch (error) {
      setStatsError(adminUtils.manejarError(error));
    } finally {
      setLoadingStats(false);
    }
  };

  const loadTransactions = async () => {
    setLoadingTransactions(true);
    setTransactionsError(null);
    try {
      const response = await coinsAdminApi.getTransactions(transactionFilters);
      if (response.success) {
        setTransactions(response.data || []);
        setTransactionsPagination(response.pagination || null);
      } else {
        setTransactionsError("No se pudieron cargar las transacciones de monedas.");
      }
    } catch (error) {
      setTransactionsError(adminUtils.manejarError(error));
    } finally {
      setLoadingTransactions(false);
    }
  };

  const loadUsersBalance = async () => {
    setLoadingUsersBalance(true);
    setUsersBalanceError(null);
    try {
      const response = await coinsAdminApi.getUsersBalance(usersFilters);
      if (response.success) {
        setUsersBalance(response.data || []);
        setUsersBalancePagination(response.pagination || null);
      } else {
        setUsersBalanceError("No se pudieron cargar los balances de usuarios.");
      }
    } catch (error) {
      setUsersBalanceError(adminUtils.manejarError(error));
    } finally {
      setLoadingUsersBalance(false);
    }
  };

  const handleChangeTransactionFilter = (field, value) => {
    setTransactionFilters((prev) => ({
      ...prev,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleChangeUsersFilter = (field, value) => {
    setUsersFilters((prev) => ({
      ...prev,
      [field]: value,
      page: field === "page" ? value : 1,
    }));
  };

  const handleOpenAddCoinsModal = (userId) => {
    setAddCoinsError(null);
    setAddCoinsForm((prev) => ({
      ...prev,
      user_id: userId || "",
    }));
    setAddCoinsModalOpen(true);
  };

  const handleAddCoinsChange = (field, value) => {
    setAddCoinsForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmitAddCoins = async (e) => {
    e?.preventDefault();
    setAddCoinsError(null);

    if (!addCoinsForm.user_id || !addCoinsForm.amount) {
      setAddCoinsError("Debes indicar ID de usuario y cantidad de monedas.");
      return;
    }

    setAddingCoins(true);
    try {
      const payload = {
        user_id: parseInt(addCoinsForm.user_id, 10),
        amount: parseInt(addCoinsForm.amount, 10),
        type: addCoinsForm.type,
        reference_id: addCoinsForm.reference_id || undefined,
      };

      const response = await coinsAdminApi.addManualCoins(payload);
      if (response.success) {
        alert(response.message || "Monedas agregadas correctamente.");
        setAddCoinsModalOpen(false);
        setAddCoinsForm({
          user_id: "",
          amount: "",
          type: "purchased",
          reference_id: "",
        });
        loadStats();
        loadTransactions();
        loadUsersBalance();
      } else {
        setAddCoinsError(response.message || "No se pudieron agregar las monedas.");
      }
    } catch (error) {
      setAddCoinsError(adminUtils.manejarError(error));
    } finally {
      setAddingCoins(false);
    }
  };

  const formatNumber = (value) => {
    if (value == null) return "-";
    return value.toLocaleString("es-ES");
  };

  const coinsData = stats?.coins || {};
  const recent = stats?.recent_activity || {};
  const revenue = stats?.revenue || {};
  const users = stats?.users || {};

  return (
    <div className="space-y-6">
      {/* Header y acciones rápidas */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-pink-300 flex items-center gap-2">
            <Coins className="w-6 h-6" />
            Sistema de Monedas
          </h2>
          <p className="text-gray-400 text-sm">
            Estadísticas globales, transacciones y balances de usuarios.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              loadStats();
              loadTransactions();
              loadUsersBalance();
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800/70 text-gray-200 border border-gray-700 hover:border-pink-500/60 hover:text-pink-200 transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Recargar todo
          </button>
          <button
            onClick={() => handleOpenAddCoinsModal("")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pink-600/80 text-white hover:bg-pink-500 transition-colors text-sm shadow-lg"
          >
            <PlusCircle className="w-4 h-4" />
            Agregar Monedas
          </button>
        </div>
      </div>

      {/* Estadísticas principales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-gray-800/60 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-yellow-500/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">
                Monedas disponibles
              </p>
              {loadingStats ? (
                <p className="text-gray-500 text-sm mt-1">Cargando...</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-yellow-300">
                    {formatNumber(coinsData.total_available_coins)}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Compradas: {formatNumber(coinsData.total_purchased_balance)} · Regalo:{" "}
                    {formatNumber(coinsData.total_gift_balance)}
                  </p>
                </>
              )}
            </div>
            <div className="p-3 bg-yellow-500/20 rounded-full">
              <Coins className="w-7 h-7 text-yellow-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-green-500/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">
                Ingresos totales
              </p>
              {loadingStats ? (
                <p className="text-gray-500 text-sm mt-1">Cargando...</p>
              ) : (
                <>
                  <p className="text-2xl font-bold text-green-300">
                    ${revenue.total_revenue?.toLocaleString("es-ES", { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-gray-500 text-xs mt-1">
                    Compras completadas: {formatNumber(revenue.total_purchases)}
                  </p>
                </>
              )}
            </div>
            <div className="p-3 bg-green-500/20 rounded-full">
              <TrendingUp className="w-7 h-7 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-blue-500/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">
                Actividad últimos {recent.days || 30} días
              </p>
              {loadingStats ? (
                <p className="text-gray-500 text-sm mt-1">Cargando...</p>
              ) : (
                <>
                  <p className="text-sm text-gray-300">
                    <span className="text-blue-300 font-semibold">
                      {formatNumber(recent.purchased_coins)}
                    </span>{" "}
                    monedas compradas
                  </p>
                  <p className="text-sm text-gray-300">
                    <span className="text-purple-300 font-semibold">
                      {formatNumber(recent.consumed_coins)}
                    </span>{" "}
                    monedas consumidas
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Regalo: {formatNumber(recent.gift_coins)} monedas
                  </p>
                </>
              )}
            </div>
            <div className="p-3 bg-blue-500/20 rounded-full">
              <Wallet className="w-7 h-7 text-blue-300" />
            </div>
          </div>
        </div>

        <div className="bg-gray-800/60 backdrop-blur-sm p-5 rounded-xl shadow-lg border border-red-500/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">
                Estado de usuarios
              </p>
              {loadingStats ? (
                <p className="text-gray-500 text-sm mt-1">Cargando...</p>
              ) : (
                <>
                  <p className="text-sm text-gray-300">
                    Activos con saldo:{" "}
                    <span className="text-green-300 font-semibold">
                      {formatNumber(users.active_with_balance)}
                    </span>
                  </p>
                  <p className="text-sm text-yellow-300">
                    Saldo bajo: {formatNumber(users.low_balance)}
                  </p>
                  <p className="text-sm text-red-300">
                    Crítico: {formatNumber(users.critical_balance)}
                  </p>
                </>
              )}
            </div>
            <div className="p-3 bg-red-500/20 rounded-full">
              <Users className="w-7 h-7 text-red-300" />
            </div>
          </div>
        </div>
      </div>

      {statsError && (
        <div className="bg-red-500/15 border border-red-500/40 text-red-300 px-4 py-3 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>{statsError}</span>
        </div>
      )}

      {/* Sección principal: Transacciones y balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Transacciones */}
        <div className="lg:col-span-2 bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-purple-500/20">
          <div className="p-5 border-b border-gray-700/50 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-purple-300" />
              <h3 className="text-lg font-semibold text-purple-200">
                Transacciones de Monedas
              </h3>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Filter className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <select
                  value={transactionFilters.type}
                  onChange={(e) =>
                    handleChangeTransactionFilter("type", e.target.value)
                  }
                  className="pl-9 pr-3 py-2 bg-gray-800/80 border border-gray-700/70 rounded-lg text-xs text-gray-200 focus:outline-none focus:border-purple-400/80"
                >
                  <option value="all">Todos los tipos</option>
                  <option value="purchased">Compradas</option>
                  <option value="gift">Regalo</option>
                </select>
              </div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar por usuario/email..."
                  value={transactionFilters.search}
                  onChange={(e) =>
                    handleChangeTransactionFilter("search", e.target.value)
                  }
                  className="pl-9 pr-3 py-2 bg-gray-800/80 border border-gray-700/70 rounded-lg text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-400/80 min-w-[200px]"
                />
              </div>
              <button
                onClick={loadTransactions}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-800/80 border border-gray-700/60 text-xs text-gray-200 hover:border-purple-400/70"
              >
                <RefreshCw className="w-3 h-3" />
                Recargar
              </button>
            </div>
          </div>
          <div className="p-5">
            {loadingTransactions ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                Cargando transacciones...
              </div>
            ) : transactionsError ? (
              <div className="flex items-center gap-2 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{transactionsError}</span>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-10 text-gray-500 text-sm">
                No hay transacciones con los filtros actuales.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700/60 text-gray-400 text-xs">
                      <th className="py-2 px-3 text-left">Usuario</th>
                      <th className="py-2 px-3 text-left">Tipo</th>
                      <th className="py-2 px-3 text-left">Origen</th>
                      <th className="py-2 px-3 text-right">Monedas</th>
                      <th className="py-2 px-3 text-right">Saldo después</th>
                      <th className="py-2 px-3 text-left">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className="border-b border-gray-800/80 hover:bg-gray-800/50"
                      >
                        <td className="py-2.5 px-3">
                          <div className="flex flex-col">
                            <span className="text-gray-200 text-sm">
                              {tx.user_name || "Usuario #" + tx.user_id}
                            </span>
                            <span className="text-gray-500 text-xs">
                              {tx.user_email}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              tx.type === "purchased"
                                ? "bg-green-500/15 text-green-300"
                                : "bg-yellow-500/15 text-yellow-300"
                            }`}
                          >
                            {tx.type_display || tx.type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-300">
                          {tx.source_display || tx.source}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-200">
                          {formatNumber(tx.amount)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-gray-400 text-xs">
                          {formatNumber(tx.balance_after)}
                        </td>
                        <td className="py-2.5 px-3 text-xs text-gray-400">
                          {tx.created_at
                            ? adminUtils.formatearFecha(tx.created_at)
                            : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Paginación de transacciones */}
            {transactionsPagination && (
              <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                <span>
                  Página {transactionsPagination.current_page} de{" "}
                  {transactionsPagination.last_page} ·{" "}
                  {transactionsPagination.total} transacciones
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={transactionFilters.page <= 1}
                    onClick={() =>
                      handleChangeTransactionFilter(
                        "page",
                        transactionFilters.page - 1
                      )
                    }
                    className="px-2 py-1 rounded bg-gray-800/80 border border-gray-700/70 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={
                      transactionFilters.page >=
                      transactionsPagination.last_page
                    }
                    onClick={() =>
                      handleChangeTransactionFilter(
                        "page",
                        transactionFilters.page + 1
                      )
                    }
                    className="px-2 py-1 rounded bg-gray-800/80 border border-gray-700/70 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Balances de usuarios */}
        <div className="bg-gray-800/60 backdrop-blur-sm rounded-xl shadow-lg border border-blue-500/20">
          <div className="p-5 border-b border-gray-700/50 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-300" />
                <h3 className="text-sm font-semibold text-blue-200">
                  Balances de Usuarios
                </h3>
              </div>
              <button
                onClick={loadUsersBalance}
                className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-900/80 border border-gray-700/70 text-xs text-gray-200 hover:border-blue-400/80"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={usersFilters.rol}
                onChange={(e) =>
                  handleChangeUsersFilter("rol", e.target.value)
                }
                className="px-3 py-1.5 rounded-lg bg-gray-900/80 border border-gray-700/70 text-xs text-gray-200 focus:outline-none focus:border-blue-400/80"
              >
                <option value="all">Clientes</option>
                <option value="cliente">Clientes</option>
                <option value="modelo">Modelos</option>
              </select>
              <select
                value={usersFilters.balance_status}
                onChange={(e) =>
                  handleChangeUsersFilter("balance_status", e.target.value)
                }
                className="px-3 py-1.5 rounded-lg bg-gray-900/80 border border-gray-700/70 text-xs text-gray-200 focus:outline-none focus:border-blue-400/80"
              >
                <option value="all">Todos los estados</option>
                <option value="low">Saldo bajo</option>
                <option value="critical">Crítico</option>
              </select>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Buscar usuario..."
                value={usersFilters.search}
                onChange={(e) =>
                  handleChangeUsersFilter("search", e.target.value)
                }
                className="pl-8 pr-3 py-1.5 bg-gray-900/80 border border-gray-700/70 rounded-lg text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-400/80 w-full"
              />
            </div>
          </div>
          <div className="p-5">
            {loadingUsersBalance ? (
              <div className="flex items-center justify-center h-40 text-gray-400 text-xs">
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Cargando balances...
              </div>
            ) : usersBalanceError ? (
              <div className="flex items-center gap-2 text-red-300 text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>{usersBalanceError}</span>
              </div>
            ) : usersBalance.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs">
                No se encontraron usuarios con saldo para los filtros actuales.
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                {usersBalance.map((u) => (
                  <div
                    key={u.user_id}
                    className="p-3 rounded-lg bg-gray-900/80 border border-gray-800/80 hover:border-blue-500/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-100 font-medium text-sm">
                            {u.user_name || `Usuario #${u.user_id}`}
                          </span>
                          {u.user_role && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-200 text-[10px] uppercase">
                              {u.user_role}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-500 text-[11px]">
                          {u.user_email}
                        </p>
                      </div>
                      <button
                        className="text-[10px] text-pink-300 hover:text-pink-200 underline"
                        onClick={() => handleOpenAddCoinsModal(u.user_id)}
                      >
                        Agregar
                      </button>
                    </div>
                    <div className="mt-2 space-y-2">
                      <div className="text-gray-300">
                        <p className="text-[11px] text-gray-400">Saldo total</p>
                        <p className="text-sm font-semibold text-yellow-300">
                          {formatNumber(u.total_balance)} monedas
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {formatNumber(u.minutes_available)} min
                        </p>
                      </div>
                      <div className="text-gray-300 text-[11px] space-y-1">
                        <p>
                          Compradas:{" "}
                          <span className="text-green-300 font-semibold">
                            {formatNumber(u.purchased_balance)}
                          </span>
                        </p>
                        <p>
                          Regalo:{" "}
                          <span className="text-purple-300 font-semibold">
                            {formatNumber(u.gift_balance)}
                          </span>
                        </p>
                        <p className="border-t border-gray-700/50 pt-1 mt-1">
                          <span className="text-gray-400">Total gastado: </span>
                          <span className="text-green-400 font-semibold">
                            ${(u.total_spent || 0).toLocaleString("es-ES", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            USD
                          </span>
                        </p>
                        <p className="flex items-center gap-1">
                          <AlertTriangle
                            className={`w-3 h-3 ${
                              u.balance_status === "critical"
                                ? "text-red-400"
                                : u.balance_status === "warning" ||
                                  u.balance_status === "low"
                                ? "text-yellow-300"
                                : "text-green-400"
                            }`}
                          />
                          <span
                            className={
                              u.balance_status === "critical"
                                ? "text-red-300"
                                : u.balance_status === "warning" ||
                                  u.balance_status === "low"
                                ? "text-yellow-300"
                                : "text-green-300"
                            }
                          >
                            {u.balance_status || "normal"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Paginación balances */}
            {usersBalancePagination && (
              <div className="mt-3 flex items-center justify-between text-[11px] text-gray-400">
                <span>
                  Página {usersFilters.page} de{" "}
                  {usersBalancePagination.last_page} ·{" "}
                  {usersBalancePagination.total} usuarios
                </span>
                <div className="flex gap-1">
                  <button
                    disabled={usersFilters.page <= 1}
                    onClick={() =>
                      handleChangeUsersFilter("page", usersFilters.page - 1)
                    }
                    className="px-2 py-1 rounded bg-gray-900/80 border border-gray-700/70 disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={
                      usersFilters.page >= usersBalancePagination.last_page
                    }
                    onClick={() =>
                      handleChangeUsersFilter("page", usersFilters.page + 1)
                    }
                    className="px-2 py-1 rounded bg-gray-900/80 border border-gray-700/70 disabled:opacity-40"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal para agregar monedas */}
      {addCoinsModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl w-full max-w-md border border-pink-500/40 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-pink-200 flex items-center gap-2">
                <PlusCircle className="w-5 h-5" />
                Agregar Monedas Manualmente
              </h3>
              <button
                onClick={() => setAddCoinsModalOpen(false)}
                className="text-gray-400 hover:text-gray-200 text-sm"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSubmitAddCoins} className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    ID de Usuario
                  </label>
                  <input
                    type="number"
                    value={addCoinsForm.user_id}
                    onChange={(e) =>
                      handleAddCoinsChange("user_id", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:border-pink-500 text-sm"
                    placeholder="Ej: 123"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Cantidad de Monedas
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={addCoinsForm.amount}
                    onChange={(e) =>
                      handleAddCoinsChange("amount", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:border-pink-500 text-sm"
                    placeholder="Ej: 100"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Tipo de Monedas
                  </label>
                  <select
                    value={addCoinsForm.type}
                    onChange={(e) =>
                      handleAddCoinsChange("type", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:border-pink-500 text-sm"
                  >
                    <option value="purchased">Compradas</option>
                    <option value="gift">Regalo</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">
                    Referencia (opcional)
                  </label>
                  <input
                    type="text"
                    value={addCoinsForm.reference_id}
                    onChange={(e) =>
                      handleAddCoinsChange("reference_id", e.target.value)
                    }
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 text-gray-100 border border-gray-700 focus:outline-none focus:border-pink-500 text-sm"
                    placeholder="ID interno, nota o referencia"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    Se recomienda indicar el motivo o referencia para auditoría
                    (ej: &quot;ajuste_saldo&quot;, &quot;compensación&quot;).
                  </p>
                </div>
              </div>

              {addCoinsError && (
                <div className="flex items-center gap-2 text-xs text-red-300 bg-red-500/10 border border-red-500/40 px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  <span>{addCoinsError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddCoinsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 border border-gray-700"
                  disabled={addingCoins}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addingCoins}
                  className="px-5 py-2 rounded-lg text-sm text-white bg-pink-600 hover:bg-pink-500 flex items-center gap-2 disabled:opacity-60"
                >
                  {addingCoins ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      Guardar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoinsModule;



