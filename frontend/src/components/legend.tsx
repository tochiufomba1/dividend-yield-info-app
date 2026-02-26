import { sectors } from "./canvas/constants";


export default function Legend() {

    return (
        <div className="legend">
            {
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