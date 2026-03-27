import { GICSSectors, sectors } from "./canvas/constants";


export default function Legend({ showGICSSectors }: { showGICSSectors: boolean }) {

    return (
        <div className="legend">
            {
                showGICSSectors ? GICSSectors.map((sector) => (
                    <div key={sector.name} className="legend-item">
                        <div
                            className="legend-color"
                            style={{ backgroundColor: sector.color }}
                        />
                        <span>{sector.name}</span>
                    </div>
                ))
                    :
                    sectors.map((sector) => (
                        <div key={sector.name} className="legend-item">
                            <div
                                className="legend-color"
                                style={{ backgroundColor: sector.color }}
                            />
                            <span>{sector.name}</span>
                        </div>
                    ))
            }
        </div>
    )
}