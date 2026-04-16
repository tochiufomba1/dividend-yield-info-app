import { IndexSnapshotButton } from '@/hooks/useIndexSnapshot'
import { ShowAllButton } from './show-all-button'
import type { ActiveSnapshotState } from '@/lib/types';

interface IndexToggleProps {
    onSelect: (data: ActiveSnapshotState) => void
}

export default function IndexToggle({
    onSelect
}: IndexToggleProps) {

    return (
        <div className='flex gap-0.5 mt-2 mb-2'>
            <ShowAllButton onData={onSelect}  />
            <IndexSnapshotButton onData={onSelect} indexType="DOWJONES" />
            <IndexSnapshotButton onData={onSelect} indexType="NASDAQ100" />
            <IndexSnapshotButton onData={onSelect} indexType="SP500" />
        </div>
    )
}