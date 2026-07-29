export const dynamic = "force-dynamic"

import { getDb } from "@/lib/db"
import * as schema from "@/lib/db/schema"
import { eq, desc, asc, sql, count } from "drizzle-orm"
import { PageHeader } from "@/components/features/admin/page-header"
import { Badge } from "@/components/shared/ui/badge"
import { Button } from "@/components/shared/ui/button"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/shared/ui/table"
import { Plus } from "lucide-react"
import { ListPagination } from "@/components/features/admin/list-pagination"
import { SortableTableHead } from "@/components/features/admin/sortable-table-head"
import { LIST_PAGE_SIZE, listPaginationOffset, parseListPage } from "@/lib/list-pagination"
import {
  buildSortHref,
  parseListSort,
  parseListSortDir,
  sortSearchParams,
  type ListSortDir,
} from "@/lib/list-sort"
import { routes } from "@/lib/routes"
import { ConfirmPaymentButton } from "./confirm-payment-button"
import { ValidatePaymentCheck } from "./validate-payment-check"

function statusBadge(status: string) {
  if (status === "succeeded") return <Badge className="bg-green-100 text-green-700 border-green-200">Exitoso</Badge>
  if (status === "pending") return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Pendiente</Badge>
  if (status === "failed") return <Badge className="bg-red-100 text-red-700 border-red-200">Fallido</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

const PAGOS_SORT_KEYS = ["userName", "concept", "amount", "method", "status", "createdAt"] as const
const PAGOS_DEFAULT_SORT = "createdAt"

type SearchParams = Promise<{ page?: string; sort?: string; dir?: string }>

function pagosOrderBy(sort: string, dir: ListSortDir) {
  const cols = {
    userName: schema.user.name,
    concept: schema.payment.concept,
    amount: schema.payment.amount,
    method: schema.payment.method,
    status: schema.payment.status,
    createdAt: schema.payment.createdAt,
  } as const
  const col = cols[sort as keyof typeof cols] ?? schema.payment.createdAt
  if (dir === "desc") return desc(col)
  return asc(col)
}

export default async function PagosPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams
  const page = parseListPage(params.page)
  const offset = listPaginationOffset(page)
  const sort = parseListSort(params.sort, PAGOS_SORT_KEYS, PAGOS_DEFAULT_SORT)
  const dir = parseListSortDir(params.dir, "desc")
  const sortQuery = sortSearchParams(sort, dir, { sort: PAGOS_DEFAULT_SORT, dir: "desc" })

  const db = getDb()

  const [{ totalRecaudado }] = await db
    .select({ totalRecaudado: sql<number>`coalesce(sum(amount), 0)` })
    .from(schema.payment)
    .where(eq(schema.payment.status, "succeeded"))

  const [{ total: totalPagos }] = await db
    .select({ total: count() })
    .from(schema.payment)

  const totalItems = Number(totalPagos)

  const pagos = await db
    .select({
      id: schema.payment.id,
      amount: schema.payment.amount,
      method: schema.payment.method,
      status: schema.payment.status,
      concept: schema.payment.concept,
      validated: schema.payment.validated,
      createdAt: schema.payment.createdAt,
      userName: schema.user.name,
    })
    .from(schema.payment)
    .innerJoin(schema.user, eq(schema.payment.userId, schema.user.id))
    .orderBy(pagosOrderBy(sort, dir))
    .limit(LIST_PAGE_SIZE)
    .offset(offset)

  const totalFormatted = new Intl.NumberFormat("es-MX", {
    style: "currency", currency: "MXN", maximumFractionDigits: 0,
  }).format(totalRecaudado ?? 0)

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Pagos"
        description={`Total recaudado: ${totalFormatted}`}
      >
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Registrar Pago
        </Button>
      </PageHeader>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <SortableTableHead
                className="text-muted-foreground font-normal text-sm"
                href={buildSortHref(routes.pagos, sort, "userName", dir, sortQuery, { sort: PAGOS_DEFAULT_SORT, dir: "desc" })}
                active={sort === "userName"}
                dir={dir}
              >
                Usuario
              </SortableTableHead>
              <SortableTableHead
                className="text-muted-foreground font-normal text-sm"
                href={buildSortHref(routes.pagos, sort, "concept", dir, sortQuery, { sort: PAGOS_DEFAULT_SORT, dir: "desc" })}
                active={sort === "concept"}
                dir={dir}
              >
                Concepto
              </SortableTableHead>
              <SortableTableHead
                className="text-muted-foreground font-normal text-sm"
                href={buildSortHref(routes.pagos, sort, "amount", dir, sortQuery, { sort: PAGOS_DEFAULT_SORT, dir: "desc" })}
                active={sort === "amount"}
                dir={dir}
              >
                Monto
              </SortableTableHead>
              <SortableTableHead
                className="text-muted-foreground font-normal text-sm"
                href={buildSortHref(routes.pagos, sort, "method", dir, sortQuery, { sort: PAGOS_DEFAULT_SORT, dir: "desc" })}
                active={sort === "method"}
                dir={dir}
              >
                Método
              </SortableTableHead>
              <SortableTableHead
                className="text-muted-foreground font-normal text-sm"
                href={buildSortHref(routes.pagos, sort, "status", dir, sortQuery, { sort: PAGOS_DEFAULT_SORT, dir: "desc" })}
                active={sort === "status"}
                dir={dir}
              >
                Estado
              </SortableTableHead>
              <SortableTableHead
                className="text-muted-foreground font-normal text-sm"
                href={buildSortHref(routes.pagos, sort, "createdAt", dir, sortQuery, { sort: PAGOS_DEFAULT_SORT, dir: "desc" })}
                active={sort === "createdAt"}
                dir={dir}
              >
                Fecha
              </SortableTableHead>
              <TableHead className="text-muted-foreground font-normal text-sm text-right">
                Acción
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Sin pagos registrados
                </TableCell>
              </TableRow>
            ) : (
              pagos.map((p) => {
                const date = p.createdAt instanceof Date
                  ? p.createdAt
                  : new Date(p.createdAt as unknown as number)
                const amountLabel = new Intl.NumberFormat("es-MX", {
                  style: "currency", currency: "MXN", maximumFractionDigits: 0,
                }).format(p.amount)
                return (
                  <TableRow key={p.id} className="border-b last:border-0">
                    <TableCell className="font-medium">{p.userName}</TableCell>
                    <TableCell className="text-muted-foreground">{p.concept ?? "—"}</TableCell>
                    <TableCell>{amountLabel}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{p.method}</TableCell>
                    <TableCell>{statusBadge(p.status)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {date.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex items-center justify-end gap-3">
                        <ValidatePaymentCheck
                          paymentId={p.id}
                          validated={p.validated}
                        />
                        {p.status === "pending" ? (
                          <ConfirmPaymentButton
                            paymentId={p.id}
                            userName={p.userName}
                            amountLabel={amountLabel}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
        <ListPagination
          basePath={routes.pagos}
          page={page}
          totalItems={totalItems}
          query={sortQuery}
        />
      </div>
    </div>
  )
}
