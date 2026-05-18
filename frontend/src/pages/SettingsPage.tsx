import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Pagination } from "../components/Pagination";

import {
  createAccountApi,
  createUserApi,
  deleteAccountApi,
  deleteUserApi,
  getAccountsApi,
  getUsersApi,
  resetUserPasswordApi,
  updateAccountApi,
  updateUserApi,
  updateUserRoleApi,
  updateUserStatusApi,
  type AccountRecord,
  type AccountType,
  type AppRole,
  type UserRecord,
} from "../services/erp-api";

const PAGE_SIZE = 12;

type SettingsTab = "users" | "accounts";

type UserFormState = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: AppRole;
};

type AccountFormState = {
  code: string;
  name: string;
  type: AccountType;
  parentAccountId: string;
};

const emptyUserForm: UserFormState = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  role: "USER",
};

const emptyAccountForm: AccountFormState = {
  code: "",
  name: "",
  type: "ASSET",
  parentAccountId: "",
};

const roleOptions: AppRole[] = ["ADMIN_GENERAL", "ADMIN", "USER"];
const accountTypeOptions: AccountType[] = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "INCOME",
  "EXPENSE",
];

function formatDate(value?: string | null): string {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleDateString("es-AR");
}

export function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("users");

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersRole, setUsersRole] = useState<AppRole | "">("");
  const [usersActiveOnly, setUsersActiveOnly] = useState<"all" | "active">(
    "all",
  );

  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [accountsTotalPages, setAccountsTotalPages] = useState(1);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [accountsPage, setAccountsPage] = useState(1);
  const [accountsSearch, setAccountsSearch] = useState("");
  const [accountsType, setAccountsType] = useState<AccountType | "">("");
  const [accountsActiveOnly, setAccountsActiveOnly] = useState<
    "all" | "active"
  >("all");

  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [userForm, setUserForm] = useState<UserFormState>(emptyUserForm);
  const [accountForm, setAccountForm] =
    useState<AccountFormState>(emptyAccountForm);

  const loadUsers = async () => {
    setUsersLoading(true);
    setUsersError(null);

    try {
      const data = await getUsersApi({
        page: usersPage,
        limit: PAGE_SIZE,
        ...(usersSearch ? { search: usersSearch } : {}),
        ...(usersRole ? { role: usersRole } : {}),
        ...(usersActiveOnly === "active" ? { activeOnly: true } : {}),
      });
      setUsers(data.items);
      setUsersTotalPages(Math.max(data.pagination.totalPages, 1));
    } catch {
      setUsersError(
        "No se pudieron cargar los usuarios (requiere ADMIN_GENERAL)",
      );
    } finally {
      setUsersLoading(false);
    }
  };

  const loadAccounts = async () => {
    setAccountsLoading(true);
    setAccountsError(null);

    try {
      const data = await getAccountsApi({
        page: accountsPage,
        limit: PAGE_SIZE,
        ...(accountsSearch ? { search: accountsSearch } : {}),
        ...(accountsType ? { type: accountsType } : {}),
        ...(accountsActiveOnly === "active" ? { activeOnly: true } : {}),
      });
      setAccounts(data.items);
      setAccountsTotalPages(Math.max(data.pagination.totalPages, 1));
    } catch {
      setAccountsError("No se pudieron cargar las cuentas contables");
    } finally {
      setAccountsLoading(false);
    }
  };

  useEffect(() => {
    void loadUsers();
  }, [usersPage, usersSearch, usersRole, usersActiveOnly]);

  useEffect(() => {
    void loadAccounts();
  }, [accountsPage, accountsSearch, accountsType, accountsActiveOnly]);

  const updateUsersFilter = (next: {
    search?: string;
    role?: AppRole | "";
    activeOnly?: "all" | "active";
  }) => {
    if (next.search !== undefined) {
      setUsersSearch(next.search);
    }
    if (next.role !== undefined) {
      setUsersRole(next.role);
    }
    if (next.activeOnly !== undefined) {
      setUsersActiveOnly(next.activeOnly);
    }
    setUsersPage(1);
  };

  const updateAccountsFilter = (next: {
    search?: string;
    type?: AccountType | "";
    activeOnly?: "all" | "active";
  }) => {
    if (next.search !== undefined) {
      setAccountsSearch(next.search);
    }
    if (next.type !== undefined) {
      setAccountsType(next.type);
    }
    if (next.activeOnly !== undefined) {
      setAccountsActiveOnly(next.activeOnly);
    }
    setAccountsPage(1);
  };

  const userStats = useMemo(() => {
    const total = users.length;
    const active = users.filter((user) => user.isActive).length;
    const admins = users.filter((user) => user.role !== "USER").length;
    return { total, active, admins };
  }, [users]);

  const accountStats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((account) => account.isActive).length;
    const byType = accountTypeOptions.reduce(
      (acc, type) => ({
        ...acc,
        [type]: accounts.filter((a) => a.type === type).length,
      }),
      {} as Record<AccountType, number>,
    );
    return { total, active, byType };
  }, [accounts]);

  const handleCreateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    const payload = {
      firstName: userForm.firstName.trim(),
      lastName: userForm.lastName.trim(),
      email: userForm.email.trim(),
      password: userForm.password,
      role: userForm.role,
    };

    if (
      !payload.firstName ||
      !payload.lastName ||
      !payload.email ||
      !payload.password
    ) {
      setFormError("Completa todos los campos obligatorios del usuario");
      setIsSaving(false);
      return;
    }

    try {
      await createUserApi(payload);
      await loadUsers();
      setUserForm(emptyUserForm);
    } catch {
      setFormError("No se pudo crear el usuario");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    const payload = {
      code: accountForm.code.trim().toUpperCase(),
      name: accountForm.name.trim(),
      type: accountForm.type,
      parentAccountId: accountForm.parentAccountId.trim() || undefined,
    };

    if (!payload.code || !payload.name) {
      setFormError("Completa codigo y nombre de la cuenta");
      setIsSaving(false);
      return;
    }

    try {
      await createAccountApi(payload);
      await loadAccounts();
      setAccountForm(emptyAccountForm);
    } catch {
      setFormError("No se pudo crear la cuenta contable");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleUserStatus = async (user: UserRecord) => {
    try {
      await updateUserStatusApi(user._id, !user.isActive);
      await loadUsers();
    } catch {
      setFormError("No se pudo actualizar el estado del usuario");
    }
  };

  const handleUserRoleChange = async (user: UserRecord, role: AppRole) => {
    try {
      await updateUserRoleApi(user._id, role);
      await loadUsers();
    } catch {
      setFormError("No se pudo cambiar el rol del usuario");
    }
  };

  const handleResetPassword = async (user: UserRecord) => {
    const newPassword = window.prompt(
      `Nueva contraseña para ${user.email} (min 8 caracteres):`,
    );

    if (!newPassword) {
      return;
    }

    try {
      await resetUserPasswordApi(user._id, newPassword);
    } catch {
      setFormError("No se pudo actualizar la contraseña");
    }
  };

  const handleEditUser = async (user: UserRecord) => {
    const firstName = window.prompt("Nombre", user.firstName)?.trim();
    if (!firstName) {
      return;
    }

    const lastName = window.prompt("Apellido", user.lastName)?.trim();
    if (!lastName) {
      return;
    }

    const email = window.prompt("Email", user.email)?.trim();
    if (!email) {
      return;
    }

    try {
      await updateUserApi(user._id, { firstName, lastName, email });
      await loadUsers();
    } catch {
      setFormError("No se pudo actualizar el usuario");
    }
  };

  const handleDeleteUser = async (user: UserRecord) => {
    if (!window.confirm(`Eliminar usuario ${user.email}?`)) {
      return;
    }

    try {
      await deleteUserApi(user._id);
      await loadUsers();
    } catch {
      setFormError("No se pudo eliminar el usuario");
    }
  };

  const handleToggleAccountStatus = async (account: AccountRecord) => {
    try {
      await updateAccountApi(account._id, { isActive: !account.isActive });
      await loadAccounts();
    } catch {
      setFormError("No se pudo actualizar el estado de la cuenta");
    }
  };

  const handleDeleteAccount = async (account: AccountRecord) => {
    if (!window.confirm(`Eliminar cuenta ${account.code}?`)) {
      return;
    }

    try {
      await deleteAccountApi(account._id);
      await loadAccounts();
    } catch {
      setFormError("No se pudo eliminar la cuenta");
    }
  };

  const handleEditAccount = async (account: AccountRecord) => {
    const code = window.prompt("Codigo", account.code)?.trim().toUpperCase();
    if (!code) {
      return;
    }

    const name = window.prompt("Nombre", account.name)?.trim();
    if (!name) {
      return;
    }

    const type = window.prompt(
      `Tipo (${accountTypeOptions.join("/")})`,
      account.type,
    ) as AccountType | null;

    if (!type || !accountTypeOptions.includes(type)) {
      setFormError("Tipo de cuenta invalido");
      return;
    }

    const parentAccountIdRaw = window.prompt(
      "Cuenta padre (dejar vacio para quitar)",
      account.parentAccountId ?? "",
    );

    try {
      await updateAccountApi(account._id, {
        code,
        name,
        type,
        parentAccountId: parentAccountIdRaw?.trim()
          ? parentAccountIdRaw.trim()
          : null,
      });
      await loadAccounts();
    } catch {
      setFormError("No se pudo actualizar la cuenta");
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Sistema · Configuraciones</p>

      <header className="page-header">
        <div>
          <h2>Configuraciones</h2>
          <p>Administracion de usuarios y plan de cuentas del sistema.</p>
        </div>
        <div className="view-controls settings-tab-switch">
          <button
            type="button"
            className={`btn ${tab === "users" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab("users")}
          >
            Usuarios
          </button>
          <button
            type="button"
            className={`btn ${tab === "accounts" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setTab("accounts")}
          >
            Cuentas
          </button>
        </div>
      </header>

      {tab === "users" && (
        <>
          <div className="kpi-grid">
            <article className="kpi-card">
              <h3>Usuarios visibles</h3>
              <strong>{userStats.total}</strong>
              <small className="kpi-neutral">Primera pagina</small>
            </article>
            <article className="kpi-card">
              <h3>Activos</h3>
              <strong>{userStats.active}</strong>
              <small>Con acceso al sistema</small>
            </article>
            <article className="kpi-card">
              <h3>Administradores</h3>
              <strong>{userStats.admins}</strong>
              <small>Roles ADMIN/ADMIN_GENERAL</small>
            </article>
            <article className="kpi-card">
              <h3>Roles disponibles</h3>
              <strong>{roleOptions.length}</strong>
              <small>Modelo de permisos vigente</small>
            </article>
          </div>

          <div className="panel-grid clients-layout">
            <article className="panel clients-panel">
              <div className="budget-toolbar">
                <label className="clients-search">
                  <span>Buscar</span>
                  <input
                    type="search"
                    value={usersSearch}
                    placeholder="Nombre o email"
                    onChange={(event) =>
                      updateUsersFilter({ search: event.target.value })
                    }
                  />
                </label>
                <label className="clients-toggle">
                  <span>Rol</span>
                  <select
                    value={usersRole}
                    onChange={(event) =>
                      updateUsersFilter({
                        role: event.target.value as AppRole | "",
                      })
                    }
                  >
                    <option value="">Todos</option>
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="clients-toggle">
                  <span>Estado</span>
                  <select
                    value={usersActiveOnly}
                    onChange={(event) =>
                      updateUsersFilter({
                        activeOnly: event.target.value as "all" | "active",
                      })
                    }
                  >
                    <option value="all">Todos</option>
                    <option value="active">Solo activos</option>
                  </select>
                </label>
              </div>

              <div className="table-wrapper">
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>Usuario</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Ultimo login</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersLoading && (
                      <tr>
                        <td colSpan={6} className="text-center">
                          Cargando usuarios...
                        </td>
                      </tr>
                    )}
                    {!usersLoading && usersError && (
                      <tr>
                        <td colSpan={6} className="text-negative text-center">
                          {usersError}
                        </td>
                      </tr>
                    )}
                    {!usersLoading && !usersError && users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center">
                          No hay usuarios para mostrar
                        </td>
                      </tr>
                    )}
                    {!usersLoading &&
                      !usersError &&
                      users.map((user, index) => (
                        <tr key={`${user._id}-${index}`}>
                          <td>
                            <div className="project-cell">
                              <strong>
                                {user.firstName} {user.lastName}
                              </strong>
                              <small>Alta: {formatDate(user.createdAt)}</small>
                            </div>
                          </td>
                          <td>{user.email}</td>
                          <td>
                            <select
                              className="settings-select"
                              value={user.role}
                              onChange={(event) =>
                                void handleUserRoleChange(
                                  user,
                                  event.target.value as AppRole,
                                )
                              }
                            >
                              {roleOptions.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <span
                              className={`budget-chip budget-chip--${user.isActive ? "activo" : "pausado"}`}
                            >
                              {user.isActive ? "ACTIVO" : "INACTIVO"}
                            </span>
                          </td>
                          <td>{formatDate(user.lastLoginAt)}</td>
                          <td>
                            <div className="budget-actions">
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => void handleEditUser(user)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn btn-tertiary"
                                onClick={() =>
                                  void handleToggleUserStatus(user)
                                }
                              >
                                {user.isActive ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => void handleResetPassword(user)}
                              >
                                Password
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() => void handleDeleteUser(user)}
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={usersPage}
                totalPages={usersTotalPages}
                onPageChange={setUsersPage}
              />
            </article>

            <article className="panel clients-form-panel">
              <div className="clients-form-header">
                <div>
                  <h3>Nuevo usuario</h3>
                  <p>Alta manual de usuarios internos.</p>
                </div>
              </div>

              <form
                className="clients-form"
                onSubmit={(event) => void handleCreateUser(event)}
              >
                <label>
                  <span>Nombre *</span>
                  <input
                    type="text"
                    value={userForm.firstName}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        firstName: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Apellido *</span>
                  <input
                    type="text"
                    value={userForm.lastName}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        lastName: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Email *</span>
                  <input
                    type="email"
                    value={userForm.email}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Password *</span>
                  <input
                    type="password"
                    value={userForm.password}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Rol</span>
                  <select
                    value={userForm.role}
                    onChange={(event) =>
                      setUserForm((current) => ({
                        ...current,
                        role: event.target.value as AppRole,
                      }))
                    }
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>

                {formError && <p className="form-error">{formError}</p>}

                <div className="clients-form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSaving}
                  >
                    {isSaving ? "Guardando..." : "Crear usuario"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setUserForm(emptyUserForm)}
                  >
                    Reiniciar
                  </button>
                </div>
              </form>
            </article>
          </div>
        </>
      )}

      {tab === "accounts" && (
        <>
          <div className="kpi-grid">
            <article className="kpi-card">
              <h3>Cuentas visibles</h3>
              <strong>{accountStats.total}</strong>
              <small className="kpi-neutral">Primera pagina</small>
            </article>
            <article className="kpi-card">
              <h3>Activas</h3>
              <strong>{accountStats.active}</strong>
              <small>Disponibles para asientos</small>
            </article>
            <article className="kpi-card">
              <h3>Activos contables</h3>
              <strong>{accountStats.byType.ASSET ?? 0}</strong>
              <small>Tipo ASSET</small>
            </article>
            <article className="kpi-card">
              <h3>Resultados</h3>
              <strong>
                {(accountStats.byType.INCOME ?? 0) +
                  (accountStats.byType.EXPENSE ?? 0)}
              </strong>
              <small>Income + Expense</small>
            </article>
          </div>

          <div className="panel-grid clients-layout">
            <article className="panel clients-panel">
              <div className="budget-toolbar">
                <label className="clients-search">
                  <span>Buscar</span>
                  <input
                    type="search"
                    value={accountsSearch}
                    placeholder="Codigo o nombre"
                    onChange={(event) =>
                      updateAccountsFilter({ search: event.target.value })
                    }
                  />
                </label>
                <label className="clients-toggle">
                  <span>Tipo</span>
                  <select
                    value={accountsType}
                    onChange={(event) =>
                      updateAccountsFilter({
                        type: event.target.value as AccountType | "",
                      })
                    }
                  >
                    <option value="">Todos</option>
                    {accountTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="clients-toggle">
                  <span>Estado</span>
                  <select
                    value={accountsActiveOnly}
                    onChange={(event) =>
                      updateAccountsFilter({
                        activeOnly: event.target.value as "all" | "active",
                      })
                    }
                  >
                    <option value="all">Todos</option>
                    <option value="active">Solo activas</option>
                  </select>
                </label>
              </div>

              <div className="table-wrapper">
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>Codigo</th>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Cuenta padre</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accountsLoading && (
                      <tr>
                        <td colSpan={6} className="text-center">
                          Cargando cuentas...
                        </td>
                      </tr>
                    )}
                    {!accountsLoading && accountsError && (
                      <tr>
                        <td colSpan={6} className="text-negative text-center">
                          {accountsError}
                        </td>
                      </tr>
                    )}
                    {!accountsLoading &&
                      !accountsError &&
                      accounts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center">
                            No hay cuentas para mostrar
                          </td>
                        </tr>
                      )}
                    {!accountsLoading &&
                      !accountsError &&
                      accounts.map((account, index) => (
                        <tr key={`${account._id}-${index}`}>
                          <td>{account.code}</td>
                          <td>{account.name}</td>
                          <td>
                            <span
                              className={`budget-chip budget-chip--${account.type.toLowerCase()}`}
                            >
                              {account.type}
                            </span>
                          </td>
                          <td>
                            {account.parentAccountId
                              ? account.parentAccountId.slice(-8)
                              : "-"}
                          </td>
                          <td>
                            <span
                              className={`budget-chip budget-chip--${account.isActive ? "activo" : "pausado"}`}
                            >
                              {account.isActive ? "ACTIVO" : "INACTIVO"}
                            </span>
                          </td>
                          <td>
                            <div className="budget-actions">
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => void handleEditAccount(account)}
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                className="btn btn-tertiary"
                                onClick={() =>
                                  void handleToggleAccountStatus(account)
                                }
                              >
                                {account.isActive ? "Desactivar" : "Activar"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-ghost"
                                onClick={() =>
                                  void handleDeleteAccount(account)
                                }
                              >
                                Eliminar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                page={accountsPage}
                totalPages={accountsTotalPages}
                onPageChange={setAccountsPage}
              />
            </article>

            <article className="panel clients-form-panel">
              <div className="clients-form-header">
                <div>
                  <h3>Nueva cuenta</h3>
                  <p>Alta de cuenta contable para plan de cuentas.</p>
                </div>
              </div>

              <form
                className="clients-form"
                onSubmit={(event) => void handleCreateAccount(event)}
              >
                <label>
                  <span>Codigo *</span>
                  <input
                    type="text"
                    value={accountForm.code}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        code: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Nombre *</span>
                  <input
                    type="text"
                    value={accountForm.name}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Tipo</span>
                  <select
                    value={accountForm.type}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        type: event.target.value as AccountType,
                      }))
                    }
                  >
                    {accountTypeOptions.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Cuenta padre</span>
                  <input
                    type="text"
                    value={accountForm.parentAccountId}
                    onChange={(event) =>
                      setAccountForm((current) => ({
                        ...current,
                        parentAccountId: event.target.value,
                      }))
                    }
                  />
                </label>

                {formError && <p className="form-error">{formError}</p>}

                <div className="clients-form-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSaving}
                  >
                    {isSaving ? "Guardando..." : "Crear cuenta"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setAccountForm(emptyAccountForm)}
                  >
                    Reiniciar
                  </button>
                </div>
              </form>
            </article>
          </div>
        </>
      )}
    </section>
  );
}
