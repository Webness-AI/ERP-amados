# cURL Collection - ERP AMADOS Backend

Coleccion de comandos cURL para probar la API del backend.

## 1) Variables base

```bash
BASE_URL="http://localhost:3000/api/v1"
TOKEN=""
COOKIE_JAR="./cookies.txt"

# IDs de trabajo (completar en tu flujo)
USER_ID=""
CLIENT_ID=""
BUDGET_ID=""
PROJECT_ID=""
MATERIAL_ID=""
REQUIREMENT_ID=""
SUPPLIER_ID=""
PURCHASE_ID=""
PRODUCTION_ORDER_ID=""
CASH_MOVEMENT_ID=""
COLLECTION_ID=""
FIXED_EXPENSE_ID=""
ACCOUNT_ID=""
JOURNAL_ENTRY_ID=""
```

## 2) Health

```bash
curl -X GET "$BASE_URL/health"
```

## 3) Auth

### Bootstrap admin (solo primera vez con BD vacia)

```bash
curl -X POST "$BASE_URL/auth/bootstrap-admin" \
	-H "Content-Type: application/json" \
	-c "$COOKIE_JAR" \
	-d '{
		"firstName": "Admin",
		"lastName": "General",
		"email": "admin@amados.local",
		"password": "Admin1234!",
		"role": "ADMIN_GENERAL"
	}'
```

### Login

```bash
curl -X POST "$BASE_URL/auth/login" \
	-H "Content-Type: application/json" \
	-c "$COOKIE_JAR" \
	-d '{
		"email": "admin@amados.local",
		"password": "Admin1234!"
	}'
```

### Refresh (usa cookie o body)

```bash
curl -X POST "$BASE_URL/auth/refresh" \
	-H "Content-Type: application/json" \
	-b "$COOKIE_JAR" \
	-c "$COOKIE_JAR" \
	-d '{}'
```

### Perfil

```bash
curl -X GET "$BASE_URL/auth/me" \
	-H "Authorization: Bearer $TOKEN"
```

### Logout

```bash
curl -X POST "$BASE_URL/auth/logout" \
	-H "Authorization: Bearer $TOKEN" \
	-b "$COOKIE_JAR"
```

## 4) Users

```bash
curl -X GET "$BASE_URL/users?page=1&limit=20" \
	-H "Authorization: Bearer $TOKEN"
```

```bash
curl -X POST "$BASE_URL/users" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"firstName": "Leonel",
		"lastName": "Amado",
		"email": "leonel@amados.local",
		"password": "Password123!",
		"role": "ADMIN"
	}'
```

```bash
curl -X PATCH "$BASE_URL/users/$USER_ID/role" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"role":"USER"}'
```

```bash
curl -X PATCH "$BASE_URL/users/$USER_ID/status" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"isActive":true}'
```

## 5) Clients

```bash
curl -X POST "$BASE_URL/clients" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"name": "Cliente Demo",
		"contactName": "Juan Perez",
		"email": "cliente@demo.com",
		"phone": "+541112345678",
		"notes": "Cliente de prueba"
	}'
```

```bash
curl -X GET "$BASE_URL/clients?search=Demo&page=1&limit=20" \
	-H "Authorization: Bearer $TOKEN"
```

## 6) Budgets

```bash
curl -X POST "$BASE_URL/budgets" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"clientId": "'$CLIENT_ID'",
		"title": "Placard dormitorio",
		"description": "Presupuesto inicial",
		"currency": "ARS",
		"items": [
			{"description":"Materiales","quantity":1,"unitPrice":250000},
			{"description":"Mano de obra","quantity":1,"unitPrice":180000}
		]
	}'
```

```bash
curl -X PATCH "$BASE_URL/budgets/$BUDGET_ID/status" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"status":"APPROVED"}'
```

## 7) Projects

```bash
curl -X POST "$BASE_URL/projects" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"clientId": "'$CLIENT_ID'",
		"budgetId": "'$BUDGET_ID'",
		"name": "Proyecto Placard Perez",
		"status": "APROBADO"
	}'
```

```bash
curl -X POST "$BASE_URL/projects/from-budget/$BUDGET_ID" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"name": "Proyecto desde presupuesto",
		"description": "Creacion automatizada"
	}'
```

```bash
curl -X PATCH "$BASE_URL/projects/$PROJECT_ID/status" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"status":"FINALIZADO"}'
```

## 8) Stock

### Materiales

```bash
curl -X POST "$BASE_URL/stock/materials" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"name": "Melamina Blanca 18mm",
		"category": "MADERA",
		"sku": "MEL-18-BLA",
		"unit": "placa",
		"minStock": 5
	}'
```

```bash
curl -X GET "$BASE_URL/stock/materials?lowStockOnly=true" \
	-H "Authorization: Bearer $TOKEN"
```

### Movimientos

```bash
curl -X POST "$BASE_URL/stock/movements" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"materialId": "'$MATERIAL_ID'",
		"type": "INGRESO",
		"quantity": 20,
		"unitCost": 10000,
		"note": "Ingreso inicial"
	}'
```

### Requerimientos por proyecto

```bash
curl -X POST "$BASE_URL/stock/project-requirements" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"projectId": "'$PROJECT_ID'",
		"materialId": "'$MATERIAL_ID'",
		"requiredQuantity": 8
	}'
```

```bash
curl -X POST "$BASE_URL/stock/project-requirements/$REQUIREMENT_ID/reserve" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"quantity": 4}'
```

### Lista de compra

```bash
curl -X GET "$BASE_URL/stock/purchase-list?page=1&limit=20" \
	-H "Authorization: Bearer $TOKEN"
```

```bash
curl -X POST "$BASE_URL/stock/purchase-list/generate" \
	-H "Authorization: Bearer $TOKEN"
```

## 9) Suppliers

```bash
curl -X POST "$BASE_URL/suppliers" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"name": "Proveedor Maderas SA",
		"contactName": "Vendedor 1",
		"email": "ventas@proveedor.com",
		"phone": "+541145678901"
	}'
```

```bash
curl -X GET "$BASE_URL/suppliers?search=Maderas" \
	-H "Authorization: Bearer $TOKEN"
```

## 10) Purchases

```bash
curl -X POST "$BASE_URL/purchases" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"supplierId": "'$SUPPLIER_ID'",
		"projectId": "'$PROJECT_ID'",
		"currency": "ARS",
		"items": [
			{"materialId":"'$MATERIAL_ID'","quantityOrdered":10,"unitCost":12000}
		]
	}'
```

```bash
curl -X PATCH "$BASE_URL/purchases/$PURCHASE_ID/status" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"status":"ORDERED"}'
```

```bash
curl -X POST "$BASE_URL/purchases/$PURCHASE_ID/receive" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"receivedItems": [
			{"materialId":"'$MATERIAL_ID'","quantityReceived":10}
		],
		"note": "Recepcion total"
	}'
```

## 11) Production orders

```bash
curl -X POST "$BASE_URL/production-orders" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"projectId": "'$PROJECT_ID'",
		"title": "Corte de placas",
		"priority": "HIGH",
		"assigneeName": "Operario 1"
	}'
```

```bash
curl -X PATCH "$BASE_URL/production-orders/$PRODUCTION_ORDER_ID/status" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"status":"ARMADO"}'
```

## 12) Cash

```bash
curl -X POST "$BASE_URL/cash/movements" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"source": "CASH",
		"direction": "INCOME",
		"paymentMethod": "EFECTIVO",
		"amount": 50000,
		"currency": "ARS",
		"concept": "Ingreso manual de caja"
	}'
```

```bash
curl -X GET "$BASE_URL/cash/movements?page=1&limit=20" \
	-H "Authorization: Bearer $TOKEN"
```

## 13) Collections

```bash
curl -X POST "$BASE_URL/collections" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"clientId": "'$CLIENT_ID'",
		"projectId": "'$PROJECT_ID'",
		"totalAmount": 300000,
		"laborAmountPending": 100000,
		"currency": "ARS"
	}'
```

```bash
curl -X POST "$BASE_URL/collections/$COLLECTION_ID/payments" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"amount": 150000,
		"paymentMethod": "TRANSFERENCIA",
		"note": "Pago parcial"
	}'
```

```bash
curl -X POST "$BASE_URL/collections/refresh-due-status" \
	-H "Authorization: Bearer $TOKEN"
```

## 14) Fixed expenses

```bash
curl -X POST "$BASE_URL/fixed-expenses" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"name": "Alquiler taller",
		"amount": 400000,
		"currency": "ARS",
		"frequency": "MENSUAL",
		"nextDueDate": "2026-06-01T00:00:00.000Z"
	}'
```

```bash
curl -X POST "$BASE_URL/fixed-expenses/$FIXED_EXPENSE_ID/pay" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"note":"Pago del mes"}'
```

```bash
curl -X POST "$BASE_URL/fixed-expenses/refresh-alerts" \
	-H "Authorization: Bearer $TOKEN"
```

## 15) Accounts (plan de cuentas)

```bash
curl -X GET "$BASE_URL/accounts?page=1&limit=50" \
	-H "Authorization: Bearer $TOKEN"
```

```bash
curl -X POST "$BASE_URL/accounts" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"code": "OTROS_GASTOS",
		"name": "Otros gastos",
		"type": "EXPENSE"
	}'
```

## 16) Accounting

### Crear asiento manual

```bash
curl -X POST "$BASE_URL/accounting/journal-entries" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{
		"description": "Asiento manual de prueba",
		"currency": "ARS",
		"lines": [
			{"accountCode":"CAJA","debit":1000,"credit":0},
			{"accountCode":"VENTAS","debit":0,"credit":1000}
		]
	}'
```

### Listar asientos

```bash
curl -X GET "$BASE_URL/accounting/journal-entries?page=1&limit=20" \
	-H "Authorization: Bearer $TOKEN"
```

### Reversar asiento

```bash
curl -X POST "$BASE_URL/accounting/journal-entries/$JOURNAL_ENTRY_ID/reverse" \
	-H "Authorization: Bearer $TOKEN" \
	-H "Content-Type: application/json" \
	-d '{"reason":"Correccion operativa"}'
```

### Reportes

```bash
curl -X GET "$BASE_URL/accounting/reports/trial-balance" \
	-H "Authorization: Bearer $TOKEN"
```

```bash
curl -X GET "$BASE_URL/accounting/reports/income-statement" \
	-H "Authorization: Bearer $TOKEN"
```

```bash
curl -X GET "$BASE_URL/accounting/reports/balance-sheet" \
	-H "Authorization: Bearer $TOKEN"
```

## 17) Dashboard

```bash
curl -X GET "$BASE_URL/dashboard/overview" \
	-H "Authorization: Bearer $TOKEN"
```

```bash
curl -X GET "$BASE_URL/dashboard/alerts?horizonHours=72&limit=10" \
	-H "Authorization: Bearer $TOKEN"
```

```bash
curl -X POST "$BASE_URL/dashboard/alerts/refresh" \
	-H "Authorization: Bearer $TOKEN"
```

```bash
curl -X GET "$BASE_URL/dashboard/alerts/scheduler-status" \
	-H "Authorization: Bearer $TOKEN"
```

## 18) Tips de uso rapido

1. Ejecuta primero auth/login y guarda accessToken en TOKEN.
2. Crea entidades base en este orden sugerido:
   - client -> budget -> project
   - material -> supplier -> purchase -> receive
   - collection/payment -> fixed-expense/pay
3. Usa los IDs devueltos por cada respuesta para completar las variables.
4. Si trabajas en PowerShell, reemplaza comillas/escape segun shell.
