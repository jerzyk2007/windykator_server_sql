const dzialMap = {
    D048: "D048/D058",
    D058: "D048/D058",
    D068: "D068/D078",
    D078: "D068/D078",
    D118: "D118/D148",
    D148: "D118/D148",
    D168: "D118/D148",
    D308: "D308/D318",
    D318: "D308/D318",
};

const addDepartment = (documents) => {
    return documents
        .map((document) => {
            const match = document.NUMER?.match(/D(\d+)/);
            if (match) {
                const dzialNumber = match[1].padStart(3, "0"); // Wypełnia do trzech cyfr
                return {
                    ...document,
                    DZIAL: dzialMap[`D${dzialNumber}`]
                        ? dzialMap[`D${dzialNumber}`]
                        : `D${dzialNumber}`, // Tworzy nową wartość z "D" i trzema cyframi
                };
            } else {
                return {
                    ...document,
                    DZIAL: "KSIĘGOWOŚĆ", // Domyślna wartość, jeśli nie można wygenerować nazwy
                };
            }
        })
        .filter(Boolean); // Usuwa undefined z tablicy
};

// zamiana daty na format yyyy-mm-dd
const checkDate = (data) => {
    const year = data.getFullYear();
    const month = String(data.getMonth() + 1).padStart(2, '0'); // Dodajemy +1, bo miesiące są liczone od 0
    const day = String(data.getDate()).padStart(2, '0');
    const yearNow = `${year}-${month}-${day}`;
    return yearNow;
};

// zamiana godziny na format hh-mm
const checkTime = (data) => {
    const hour = String(data.getHours()).padStart(2, '0');
    const min = String(data.getMinutes()).padStart(2, '0');
    const timeNow = `${hour}:${min}`;

    return timeNow;
};

module.exports = {
    addDepartment,
    checkDate,
    checkTime
};