import type { CustomTickerData } from "@/hooks/useCustomTickers"
import { Controller, useForm } from "react-hook-form"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Card, CardContent } from "./ui/card"
import * as z from "zod"
import { GICSSectors, sectors } from "./canvas/constants"
import { zodResolver } from "@hookform/resolvers/zod"
import { Field, FieldError, FieldGroup, FieldLabel } from "./ui/field"
import Input from "@mui/material/Input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Button } from "./ui/button"
import { useState } from "react"

interface CustomTickerDialogProps {
    addTicker: (item: CustomTickerData) => void
    hasTicker: (ticker: string) => boolean
}

const AddCustomTickerFormSchema = z.object({
    ticker: z.string().min(1).max(6),
    name: z.string().min(1),
    ImSquare_Sector: z.enum(sectors.map(s => s.name)),
    GICS_Sector: z.enum(GICSSectors.map(s => s.name)),
    yield: z.optional(z.coerce.number()),
    netProfit: z.optional(z.coerce.number()),
    costInvestment: z.optional(z.coerce.number()),
})

export default function CustomTickerDialog({
    addTicker,
    hasTicker
}: CustomTickerDialogProps) {
    const [open, setOpen] = useState(false);
    const [formError, setFormError] = useState<any | null>(null)

    async function submit(formValues: z.infer<typeof AddCustomTickerFormSchema>) {
        setFormError({})

        // check if already in custom ticker list (prevent duplicates)
        if (hasTicker(formValues.ticker)) {
            setFormError([{ message: "Cannot add duplicate ticker" }])
            return
        }

        // stock outside SEC list
        if (formValues.yield) {
            addTicker({
                ticker: formValues.ticker,
                name: formValues.name,
                ImSquare_Sector: formValues.ImSquare_Sector,
                GICS_Sector: formValues.GICS_Sector,
                yield: formValues.yield
            })

            setOpen(false)
            return
        }

        if (!formValues.netProfit || !formValues.costInvestment) {
            setFormError([{ message: "Must provide net profit and investment cost values for custom investment" }])
            return
        }

        // investment (private business, other)
        const roi = (formValues.netProfit / formValues.costInvestment)
        addTicker(
            {
                ticker: formValues.ticker,
                name: formValues.name,
                ImSquare_Sector: formValues.ImSquare_Sector,
                GICS_Sector: formValues.GICS_Sector,
                yield: roi
            }
        )

        setOpen(false)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger>Add Custom Ticker</DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Custom Ticker</DialogTitle>
                    <DialogDescription>
                    </DialogDescription>
                </DialogHeader>
                <Card>
                    <CardContent>
                        <Tabs defaultValue="investment">
                            <TabsList>
                                <TabsTrigger value="investment">Investment</TabsTrigger>
                                <TabsTrigger value="divident-stock">Dividend Stock</TabsTrigger>
                            </TabsList>
                            <TabsContent value="investment">
                                <AddCustomInvestmentForm submit={submit} error={formError} />
                            </TabsContent>
                            <TabsContent value="divident-stock">
                                <AddCustomStockForm submit={submit} error={formError} />
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </DialogContent>
        </Dialog>
    )
}


function AddCustomStockForm({
    submit,
    error
}: {
    submit: (formValues: z.infer<typeof AddCustomTickerFormSchema>) => void
    error: any | null,
}) {
    const {
        control,
        handleSubmit,
    } = useForm({
        resolver: zodResolver(AddCustomTickerFormSchema),
        defaultValues: {
            ticker: "EXAMP",
            name: "Example",
            ImSquare_Sector: "Unknown",
            GICS_Sector: "Unknown",
            yield: 0.00
        },
    })

    return (
        <form onSubmit={handleSubmit(submit)}>
            <FieldGroup>
                <Controller
                    name="ticker"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-ticker">
                                Ticker
                            </FieldLabel>
                            <Input
                                {...field}
                                id="form-custom-ticker"
                                aria-invalid={fieldState.invalid}
                                autoComplete="off"
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="name"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-name">
                                Name
                            </FieldLabel>
                            <Input
                                {...field}
                                id="form-custom-name"
                                aria-invalid={fieldState.invalid}
                                autoComplete="off"
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="ImSquare_Sector"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-sector">
                                ImSquare Sector
                            </FieldLabel>
                            <Select
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                            >
                                <SelectTrigger
                                    id="form-custom-sector"
                                    aria-invalid={fieldState.invalid}
                                    className="min-w-120px"
                                >
                                    <SelectValue placeholder="Select a sector" />
                                </SelectTrigger>
                                <SelectContent position="item-aligned">
                                    {sectors.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="GICS_Sector"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-sector">
                                GICS Sector
                            </FieldLabel>
                            <Select
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                            >
                                <SelectTrigger
                                    id="form-custom-sector"
                                    aria-invalid={fieldState.invalid}
                                    className="min-w-120px"
                                >
                                    <SelectValue placeholder="Select a sector" />
                                </SelectTrigger>
                                <SelectContent position="item-aligned">
                                    {GICSSectors.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="yield"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-yield">
                                Yield
                            </FieldLabel>
                            <Input
                                {...field}
                                id="form-custom-yield"
                                aria-invalid={fieldState.invalid}
                                autoComplete="off"
                                required={true}
                                type="number"
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                {error && <Field> <FieldError errors={error} /></Field>}
            </FieldGroup>

            <Button type="submit" className="border-2">Submit</Button>
        </form>
    )
}

function AddCustomInvestmentForm({
    submit,
    error
}: {
    submit: (formValues: z.infer<typeof AddCustomTickerFormSchema>) => void,
    error: any | null,
}
) {
    const {
        control,
        handleSubmit,
    } = useForm({
        resolver: zodResolver(AddCustomTickerFormSchema),
        defaultValues: {
            ticker: "EXAMP",
            name: "Example",
            ImSquare_Sector: "Unknown",
            GICS_Sector: "Unknown",
            netProfit: 1.00,
            costInvestment: 1.00
        },
    })

    return (
        <form onSubmit={handleSubmit(submit)}>
            <FieldGroup>
                <Controller
                    name="ticker"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-ticker">
                                Ticker
                            </FieldLabel>
                            <Input
                                {...field}
                                id="form-custom-ticker"
                                aria-invalid={fieldState.invalid}
                                autoComplete="off"
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="name"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-name">
                                Name
                            </FieldLabel>
                            <Input
                                {...field}
                                id="form-custom-name"
                                aria-invalid={fieldState.invalid}
                                autoComplete="off"
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="ImSquare_Sector"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-sector">
                                ImSquare Sector
                            </FieldLabel>
                            <Select
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                            >
                                <SelectTrigger
                                    id="form-custom-sector"
                                    aria-invalid={fieldState.invalid}
                                    className="min-w-120px"
                                >
                                    <SelectValue placeholder="Select a sector" />
                                </SelectTrigger>
                                <SelectContent position="item-aligned">
                                    {sectors.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="GICS_Sector"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-sector">
                                GICS Sector
                            </FieldLabel>
                            <Select
                                name={field.name}
                                value={field.value}
                                onValueChange={field.onChange}
                            >
                                <SelectTrigger
                                    id="form-custom-sector"
                                    aria-invalid={fieldState.invalid}
                                    className="min-w-120px"
                                >
                                    <SelectValue placeholder="Select a sector" />
                                </SelectTrigger>
                                <SelectContent position="item-aligned">
                                    {GICSSectors.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                                </SelectContent>
                            </Select>

                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="netProfit"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-netProfit">
                                Net Profit
                            </FieldLabel>
                            <Input
                                {...field}
                                id="form-custom-netProfit"
                                aria-invalid={fieldState.invalid}
                                autoComplete="off"
                                required={true}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                <Controller
                    name="costInvestment"
                    control={control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor="form-custom-costInvestment">
                                Cost Investment
                            </FieldLabel>
                            <Input
                                {...field}
                                id="form-custom-costInvestment"
                                aria-invalid={fieldState.invalid}
                                autoComplete="off"
                                required={true}
                            />
                            {fieldState.invalid && (
                                <FieldError errors={[fieldState.error]} />
                            )}
                        </Field>
                    )}
                />

                {error && <Field> <FieldError errors={error} /></Field>}
            </FieldGroup>

            <Button type="submit" className="border-2">Submit</Button>
        </form>
    )
}