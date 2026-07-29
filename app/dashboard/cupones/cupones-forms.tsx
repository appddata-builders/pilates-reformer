"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CircleCheck, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/shared/ui/button"
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/shared/ui/table"
import { Badge } from "@/components/shared/ui/badge"
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/shared/ui/dialog"
import { Label } from "@/components/shared/ui/label"
import { Input } from "@/components/shared/ui/input"
import { useDbActionFeedback } from "@/components/features/admin/db-action-feedback"
import { ConfirmRemoveDialog } from "@/components/features/admin/confirm-remove-dialog"
import { couponDiscountLabel } from "@/lib/coupon-pricing"
import {
  createCouponAction,
  deleteCouponAction,
  toggleCouponAction,
  updateCouponAction,
} from "./actions"

export type CouponRow = {
  id: string
  code: string
  name: string
  discountType: string
  discountValue: number
  maxUses: number | null
  usedCount: number
  validFrom: string
  validUntil: string
  isActive: boolean
}

export function CuponesFormsClient(props: { cupones: CouponRow[] }) {
  const { showDbActionFeedback } = useDbActionFeedback()
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editCoupon, setEditCoupon] = useState<CouponRow | null>(null)
  const [deleteCoupon, setDeleteCoupon] = useState<CouponRow | null>(null)
  const [createType, setCreateType] = useState("percent")
  const [editType, setEditType] = useState("percent")
  const [createError, setCreateError] = useState("")
  const [editError, setEditError] = useState("")

  useEffect(() => {
    if (editCoupon != null) setEditType(editCoupon.discountType)
  }, [editCoupon])

  async function handleCreate(formData: FormData) {
    setCreateError("")
    const res = await createCouponAction({ success: false }, formData)
    if (res.success) {
      showDbActionFeedback("create")
      setCreateOpen(false)
      setCreateType("percent")
      router.refresh()
      return
    }
    setCreateError(res.error ?? "No se pudo crear el cupón")
  }

  async function handleEdit(formData: FormData) {
    setEditError("")
    const res = await updateCouponAction({ success: false }, formData)
    if (res.success) {
      showDbActionFeedback("update")
      setEditOpen(false)
      setEditCoupon(null)
      router.refresh()
      return
    }
    setEditError(res.error ?? "No se pudo actualizar el cupón")
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div data-tour="page-header">
          <h1 className="text-2xl font-semibold tracking-tight">Cupones</h1>
          <p className="text-sm text-muted-foreground">
            {props.cupones.length} cupones. Úsalos al asignar un plan para recalcular el precio.
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(open) => {
            setCreateOpen(open)
            if (!open) setCreateError("")
          }}
        >
          <DialogTrigger asChild>
            <Button data-tour="page-actions" className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo cupón
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo cupón</DialogTitle>
            </DialogHeader>
            <form action={(fd) => void handleCreate(fd)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="create-code">Código</Label>
                <Input id="create-code" name="code" required minLength={2} placeholder="BIENVENIDA20" className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-name">Nombre</Label>
                <Input id="create-name" name="name" required minLength={2} placeholder="Bienvenida 20%" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-discountType">Tipo de descuento</Label>
                <select
                  id="create-discountType"
                  name="discountType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                >
                  <option value="percent">Porcentaje (%)</option>
                  <option value="fixed">Monto fijo (MXN)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-discountValue">
                  {createType === "fixed" ? "Monto (MXN)" : "Porcentaje"}
                </Label>
                <Input
                  id="create-discountValue"
                  name="discountValue"
                  type="number"
                  min={1}
                  max={createType === "percent" ? 100 : undefined}
                  step="1"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-maxUses">Usos máximos (opcional)</Label>
                <Input id="create-maxUses" name="maxUses" type="number" min={1} placeholder="Sin límite" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="create-validFrom">Vigente desde</Label>
                  <Input id="create-validFrom" name="validFrom" type="date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-validUntil">Vigente hasta</Label>
                  <Input id="create-validUntil" name="validUntil" type="date" />
                </div>
              </div>
              {createError ? <p className="text-sm text-destructive">{createError}</p> : null}
              <DialogFooter>
                <Button type="submit" className="w-full">Crear cupón</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div data-tour="page-table" className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-b">
              <TableHead className="text-muted-foreground font-normal text-sm">Código</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Nombre</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Descuento</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Usos</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Vigencia</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm">Estado</TableHead>
              <TableHead className="text-muted-foreground font-normal text-sm text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.cupones.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Sin cupones. Crea uno para usarlo al asignar planes.
                </TableCell>
              </TableRow>
            ) : (
              props.cupones.map((c) => (
                <TableRow key={c.id} className={`border-b last:border-0 ${!c.isActive ? "opacity-60" : ""}`}>
                  <TableCell className="font-mono font-medium">{c.code}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{couponDiscountLabel(c.discountType, c.discountValue)}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.usedCount}
                    {c.maxUses != null ? ` / ${c.maxUses}` : " / ∞"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.validFrom || c.validUntil
                      ? `${c.validFrom || "—"} → ${c.validUntil || "—"}`
                      : "Sin límite"}
                  </TableCell>
                  <TableCell>
                    {c.isActive ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200">Activo</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-700 border-gray-200">Inactivo</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditCoupon(c)
                          setEditOpen(true)
                          setEditError("")
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        <span className="sr-only">Editar</span>
                      </Button>
                      {!c.isActive ? (
                        <form
                          action={async (fd) => {
                            await toggleCouponAction(fd)
                            showDbActionFeedback("update")
                            router.refresh()
                          }}
                        >
                          <input type="hidden" name="id" value={c.id} />
                          <Button type="submit" variant="ghost" size="icon" className="h-8 w-8 text-green-700">
                            <CircleCheck className="h-4 w-4" />
                            <span className="sr-only">Reactivar</span>
                          </Button>
                        </form>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => setDeleteCoupon(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Desactivar</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open)
          if (!open) {
            setEditCoupon(null)
            setEditError("")
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cupón</DialogTitle>
          </DialogHeader>
          {editCoupon != null ? (
            <form action={(fd) => void handleEdit(fd)} className="space-y-4">
              <input type="hidden" name="id" value={editCoupon.id} />
              <div className="space-y-2">
                <Label htmlFor="edit-code">Código</Label>
                <Input id="edit-code" name="code" required minLength={2} defaultValue={editCoupon.code} className="uppercase" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nombre</Label>
                <Input id="edit-name" name="name" required minLength={2} defaultValue={editCoupon.name} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-discountType">Tipo de descuento</Label>
                <select
                  id="edit-discountType"
                  name="discountType"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                >
                  <option value="percent">Porcentaje (%)</option>
                  <option value="fixed">Monto fijo (MXN)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-discountValue">
                  {editType === "fixed" ? "Monto (MXN)" : "Porcentaje"}
                </Label>
                <Input
                  id="edit-discountValue"
                  name="discountValue"
                  type="number"
                  min={1}
                  max={editType === "percent" ? 100 : undefined}
                  step="1"
                  required
                  defaultValue={editCoupon.discountValue}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-maxUses">Usos máximos (opcional)</Label>
                <Input
                  id="edit-maxUses"
                  name="maxUses"
                  type="number"
                  min={1}
                  defaultValue={editCoupon.maxUses ?? undefined}
                  placeholder="Sin límite"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="edit-validFrom">Vigente desde</Label>
                  <Input id="edit-validFrom" name="validFrom" type="date" defaultValue={editCoupon.validFrom} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-validUntil">Vigente hasta</Label>
                  <Input id="edit-validUntil" name="validUntil" type="date" defaultValue={editCoupon.validUntil} />
                </div>
              </div>
              {editError ? <p className="text-sm text-destructive">{editError}</p> : null}
              <DialogFooter>
                <Button type="submit" className="w-full">Guardar cambios</Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmRemoveDialog
        open={deleteCoupon != null}
        onOpenChange={(open) => {
          if (!open) setDeleteCoupon(null)
        }}
        title="¿Desactivar este cupón?"
        description={
          deleteCoupon != null
            ? `El cupón ${deleteCoupon.code} dejará de poder usarse en nuevos planes.`
            : ""
        }
        confirmLabel="Sí, desactivar"
        feedbackKind="delete"
        hiddenFields={deleteCoupon != null ? [{ name: "id", value: deleteCoupon.id }] : []}
        serverAction={async (fd) => {
          const res = await deleteCouponAction(fd)
          if (res.success) {
            setDeleteCoupon(null)
            router.refresh()
          }
          return res
        }}
      />
    </div>
  )
}
