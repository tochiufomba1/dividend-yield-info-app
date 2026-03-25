import type { SnapshotEntry } from "./canvas/types";
import { columns } from "./table/columns";
import { DataTable } from "./table/table";

export default function StocksTable({ 
    data
}: {
    data: SnapshotEntry[]
}) {

    return (
        <div className="container mx-auto py-10">
            <DataTable columns={columns} data={data} />
        </div>
    )
}