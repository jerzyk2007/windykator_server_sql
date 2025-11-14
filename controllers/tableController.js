const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { format } = require("date-fns");

// formatowanie tabeli z danymi
const muiTableBodyCellProps = {
  align: "center",

  sx: {
    fontFamily: "Calibri, sans-serif",
    fontSize: "15px",
    borderRight: "1px solid rgba(99, 99, 99, .8)",
    borderTop: "1px solid rgba(99, 99, 99, .8)",
    fontWeight: "500",
    minHeight: "65px",
    textWrap: "balance",
    whiteSpace: "pre-wrap",
  },
};

// przygotowanie kolumn w tabeli
const prepareTableColumns = (columnsData) => {
  const update = columnsData.map((item) => {
    const modifiedItem = { ...item };

    modifiedItem.muiTableBodyCellProps = muiTableBodyCellProps;

    if (item.filterVariant === "date-range") {
      modifiedItem.accessorFn = (originalRow) => {
        const date = new Date(originalRow[item.accessorKey]);
        // ustaw godzinę na początek dnia, by uniknąć problemów z filtrowaniem
        date.setHours(0, 0, 0, 0);
        return date;
      };

      modifiedItem.Cell = ({ cell }) => {
        // Parsowanie wartości komórki jako data
        const date = new Date(cell.getValue());
        // Sprawdzenie, czy data jest prawidłowa
        if (!isNaN(date)) {
          return format(date, "yyyy-MM-dd");
        } else {
          // Jeśli data jest nieprawidłowa, zwracamy pusty string lub inny komunikat błędu
          return "brak danych";
        }
      };
    }

    // if (item.accessorKey === "UWAGI_ASYSTENT") {
    //   modifiedItem.Cell = ({ cell }) => {
    //     const cellValue = cell.getValue();
    //     if (Array.isArray(cellValue) && cellValue.length > 0) {
    //       let numberOfObjects = cellValue.length;
    //       return (
    //         <div style={{ whiteSpace: "pre-wrap" }}>
    //           {numberOfObjects > 1 && (
    //             <p>{`Liczba wpisów wcześniejszych: ${numberOfObjects - 1}`}</p>
    //           )}
    //           {cellValue.map((item, index) => (
    //             <p key={index}>
    //               {
    //                 index === cellValue.length - 1 // Sprawdzanie czy to ostatni element w tablicy
    //                   ? item.length > 200 // Sprawdzenie długości tekstu
    //                     ? item.slice(0, 200) + "..." // Jeśli tekst jest dłuższy niż 150 znaków, obetnij i dodaj trzy kropki na końcu
    //                     : item // W przeciwnym razie, wyświetl pełny tekst
    //                   : null // W przeciwnym razie, nie wyświetlaj nic
    //               }
    //             </p>
    //           ))}
    //         </div>
    //       );
    //     } else {
    //       <p>Brak</p>;
    //     }
    //   };

    //   const changeMuiTableBodyCellProps = { ...muiTableBodyCellProps };
    //   changeMuiTableBodyCellProps.align = "left";
    //   const updatedSx = { ...changeMuiTableBodyCellProps.sx };
    //   updatedSx.backgroundColor = "rgba(248, 255, 152, .2)";
    //   changeMuiTableBodyCellProps.sx = updatedSx;
    //   modifiedItem.muiTableBodyCellProps = changeMuiTableBodyCellProps;
    //   modifiedItem.enableClickToCopy = false;
    // }

    if (
      item.accessorKey === "UWAGI_Z_FAKTURY" ||
      item.accessorKey === "STATUS_SPRAWY_KANCELARIA" ||
      item.accessorKey === "OPIS_ROZRACHUNKU"
    ) {
      modifiedItem.Cell = ({ cell }) => {
        const cellValue = cell.getValue();
        if (typeof cellValue === "string" && cellValue.length > 150) {
          return cellValue.slice(0, 150) + " ...";
        }
        return cellValue;
      };
    }

    if (item.accessorKey === "KONTRAHENT") {
      modifiedItem.muiTableBodyCellProps = ({ cell }) => {
        // const cellValue = cell.getValue();
        const checkClient = cell.row.original.ZAZNACZ_KONTRAHENTA;

        return {
          align: "left",
          sx: {
            ...muiTableBodyCellProps.sx,
            backgroundColor:
              cell.column.id === "KONTRAHENT" && checkClient === "TAK"
                ? "#7fffd4"
                : "white",
          },
        };
      };
      modifiedItem.filterFn = "contains";
    }

    // if (item.accessorKey === "ZAZNACZ_KONTRAHENTA") {
    //   modifiedItem.Cell = ({ cell, row }) => {
    //     const cellValue = cell.getValue();

    //     return <span>{cellValue}</span>;
    //   };
    // }

    if (item.accessorKey === "ZAZNACZ_KONTRAHENTA") {
      modifiedItem.Cell = ({ cell, row }) => {
        const cellValue = cell.getValue();

        // Jeśli wartość komórki jest null, wyświetl "NIE", w przeciwnym razie wyświetl wartość
        const displayValue = cellValue === null ? "NIE" : cellValue;

        return displayValue;
      };
    }

    if (item.accessorKey === "ILE_DNI_PO_TERMINIE") {
      modifiedItem.muiTableBodyCellProps = ({ cell }) => ({
        ...muiTableBodyCellProps,
        sx: {
          ...muiTableBodyCellProps.sx,
          backgroundColor:
            cell.column.id === "ILE_DNI_PO_TERMINIE" && cell.getValue() > 0
              ? "rgb(250, 136, 136)"
              : "white",
        },
      });
    }

    if (item.accessorKey === "DO_ROZLICZENIA") {
      modifiedItem.muiTableBodyCellProps = ({ cell }) => ({
        ...muiTableBodyCellProps,
        sx: {
          ...muiTableBodyCellProps.sx,
          backgroundColor: "rgba(248, 255, 152, .2)",
        },
      });
    }

    if (item.accessorKey === "OSTATECZNA_DATA_ROZLICZENIA") {
      modifiedItem.accessorFn = (originalRow) => {
        return originalRow[item.accessorKey]
          ? originalRow[item.accessorKey]
          : "BRAK";
      };
    }

    if (item.accessorKey === "NR_SZKODY") {
      modifiedItem.accessorFn = (originalRow) => {
        return originalRow[item.accessorKey]
          ? originalRow[item.accessorKey]
          : "";
      };
    }

    if (item.accessorKey === "NR_SZKODY") {
      modifiedItem.accessorFn = (originalRow) => {
        return originalRow[item.accessorKey]
          ? originalRow[item.accessorKey]
          : "";
      };
    }

    if (item.accessorKey === "NR_REJESTRACYJNY") {
      modifiedItem.accessorFn = (originalRow) => {
        return originalRow[item.accessorKey]
          ? originalRow[item.accessorKey]
          : "";
      };
    }

    if (item.accessorKey === "KRD") {
      modifiedItem.accessorFn = (originalRow) => {
        return originalRow[item.accessorKey]
          ? originalRow[item.accessorKey]
          : "BRAK";
      };
    }
    if (item.accessorKey === "50_VAT") {
      modifiedItem.muiTableBodyCellProps = ({ cell }) => {
        const cellValue = cell.getValue();
        const dorozliczValue = cell.row.original.DO_ROZLICZENIA;

        return {
          ...muiTableBodyCellProps,
          sx: {
            ...muiTableBodyCellProps.sx,
            backgroundColor:
              cell.column.id === "50_VAT" &&
              Math.abs(cellValue - dorozliczValue) <= 1
                ? "rgb(250, 136, 136)"
                : "white",
          },
        };
      };
    }

    if (item.accessorKey === "100_VAT") {
      modifiedItem.muiTableBodyCellProps = ({ cell }) => {
        const cellValue = cell.getValue();
        const dorozliczValue = cell.row.original.DO_ROZLICZENIA;
        return {
          ...muiTableBodyCellProps,
          sx: {
            ...muiTableBodyCellProps.sx,
            backgroundColor:
              cell.column.id === "100_VAT" &&
              Math.abs(cellValue - dorozliczValue) <= 1
                ? "rgb(250, 136, 136)"
                : "white",
          },
        };
      };
    }

    if (item.accessorKey === "INFORMACJA_ZARZAD") {
      modifiedItem.accessorFn = (originalRow) => {
        const arrayData = originalRow.INFORMACJA_ZARZAD;

        if (!Array.isArray(arrayData) || arrayData.length === 0) return "BRAK";

        const last = arrayData[arrayData.length - 1];
        return typeof last === "string"
          ? last.length > 90
            ? last.slice(0, 90) + " …"
            : last
          : "BRAK";
      };
    }

    if (item.accessorKey === "UWAGI_ASYSTENT") {
      modifiedItem.accessorFn = (originalRow) => {
        const arrayData = originalRow.UWAGI_ASYSTENT;
        if (!arrayData) return "";
        try {
          const dzialania =
            Array.isArray(arrayData) && arrayData.length > 0
              ? arrayData.length === 1
                ? arrayData[0]
                : `Liczba wcześniejszych wpisów: ${arrayData.length - 1}\n${
                    arrayData[arrayData.length - 1]
                  }`
              : "";
          return dzialania.length > 120
            ? dzialania.slice(0, 120) + " …"
            : dzialania;
          // return "BRAK";
        } catch {
          return "BRAK";
        }
      };
      modifiedItem.muiTableBodyCellProps = {
        ...muiTableBodyCellProps,
        sx: {
          ...muiTableBodyCellProps.sx,
          backgroundColor: "rgba(148, 255, 152, .2)", // nadpisanie koloru tła
        },
      };
    }

    if (item.filterVariant === "none") {
      modifiedItem.enableColumnFilter = false;
      delete modifiedItem.filterVariant;
    }

    // if (item.filterVariant === "range-slider") {
    //   modifiedItem.muiFilterSliderProps = {
    //     marks: true,
    //     max: data.reduce(
    //       (max, key) => Math.max(max, key[item.accessorKey]),
    //       Number.NEGATIVE_INFINITY
    //     ),
    //     min: data.reduce(
    //       (min, key) => Math.min(min, key[item.accessorKey]),
    //       Number.POSITIVE_INFINITY
    //     ),
    //     step: 100,
    //     valueLabelFormat: (value) =>
    //       value.toLocaleString("pl-PL", {
    //         style: "currency",
    //         currency: "PLN",
    //       }),
    //   };
    // }

    if (item.type === "money") {
      modifiedItem.Cell = ({ cell }) => {
        const value = cell.getValue();

        const formattedSalary =
          value !== undefined && value !== null && value !== 0
            ? value.toLocaleString("pl-PL", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: true,
              })
            : "0,00";

        return formattedSalary;
      };
    }

    // if (item.accessorKey === "KWOTA_WINDYKOWANA_BECARED") {
    //   modifiedItem.accessorFn = (originalRow) => {
    //     return originalRow[item.accessorKey]
    //       ? originalRow[item.accessorKey]
    //       : " ";
    //   };
    //   modifiedItem.Cell = ({ cell }) => {
    //     const value = cell.getValue();
    //     const formattedSalary =
    //       value !== undefined && value !== null && value !== 0
    //         ? value.toLocaleString("pl-PL", {
    //           minimumFractionDigits: 2,
    //           maximumFractionDigits: 2,
    //           useGrouping: true,
    //         })
    //         : "0,00"; // Zastąp puste pola zerem

    //     return `${formattedSalary}`;
    //   };
    // }
    if (item.accessorKey === "KWOTA_WINDYKOWANA_BECARED") {
      modifiedItem.accessorFn = (originalRow) => {
        return originalRow[item.accessorKey] !== null &&
          originalRow[item.accessorKey] !== undefined
          ? originalRow[item.accessorKey]
          : ""; // Jeżeli wartość jest null lub undefined, zwracamy 'BRAK'
      };

      modifiedItem.Cell = ({ cell }) => {
        const value = cell.getValue();

        // Sprawdzenie, czy wartość jest liczbą
        const formattedValue =
          typeof value === "number"
            ? value.toLocaleString("pl-PL", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: true,
              })
            : value; // Wartość pozostaje bez zmian, jeśli to nie liczba (np. 'BRAK')

        // return <span>{formattedValue}</span>; // Zwracamy sformatowaną wartość
        return formattedValue; // Zwracamy sformatowaną wartość
      };
    }
    modifiedItem.columnFilterModeOptions = [];
    delete modifiedItem.type;
    return modifiedItem;
  });
  return update;
};

// funkcja sprawdzająca poprzednie ustawienia tabeli użytkownika i dopasowująca nowe po zmianie dostępu do działu
const verifyUserTableConfig = async (id_user, permission, newDeps) => {
  try {
    // zakładamy że `departments` to tablica obiektów jak { department: 'D001', company: 'KRT' }
    if (!newDeps.length) return;

    const [columnsFromSettings] = await connect_SQL.query(
      "SELECT * FROM company_table_columns WHERE EMPLOYEE = ?",
      [permission]
    );

    const whereClauses = newDeps
      .map(() => `(ji.DEPARTMENT = ? AND ji.COMPANY = ?)`)
      .join(" OR ");
    const values = newDeps.flatMap((dep) => [dep.department, dep.company]);
    const query = `
      SELECT DISTINCT ji.AREA
      FROM company_users AS u
      LEFT JOIN company_join_items AS ji
        ON (${whereClauses})
      WHERE u.id_user = ?
    `;

    // Dodaj id_user na końcu wartości
    values.push(id_user);

    const [getUserAreas] = await connect_SQL.query(query, values);

    // pobieram ustawienia kolumn, przypisanych działów i ustawień tabeli danego użytkownika
    const [checkDepartments] = await connect_SQL.query(
      "SELECT permissions, columns, departments, tableSettings FROM company_users WHERE id_user = ?",
      [id_user]
    );
    const { permissions, columns, tableSettings } = checkDepartments[0];

    const areaDep = columnsFromSettings.reduce((acc, column) => {
      column.AREAS.forEach((area) => {
        if (area.available) {
          const existingEntry = acc.find((entry) =>
            entry.hasOwnProperty(area.name)
          );
          if (existingEntry) {
            existingEntry[area.name].push({
              accessorKey: column.ACCESSOR_KEY,
              header: column.HEADER,
              filterVariant: column.FILTER_VARIANT,
              type: column.TYPE,
            });
          } else {
            acc.push({
              [area.name]: [
                {
                  accessorKey: column.ACCESSOR_KEY,
                  header: column.HEADER,
                  filterVariant: column.FILTER_VARIANT,
                  type: column.TYPE,
                },
              ],
            });
          }
        }
      });
      return acc;
    }, []);

    //  obszary(area) do jakich ma dostęp uzytkownik
    const areaUsers = getUserAreas.map((item) => item.AREA);

    // 1. Przefiltruj areaDep, aby zostawić tylko obiekty o nazwach w areaUsers.
    const filteredAreas = areaDep.filter((area) =>
      Object.keys(area).some((key) => areaUsers.includes(key))
    );

    // 2. Wyciągnij wszystkie obiekty z pasujących kluczy.
    const combinedObjects = filteredAreas.flatMap((area) =>
      Object.entries(area)
        .filter(([key]) => areaUsers.includes(key))
        .flatMap(([, values]) => values)
    );

    // 3. Usuń duplikaty na podstawie accessorKey.
    const uniqueObjects = combinedObjects.reduce((acc, obj) => {
      if (!acc.some((item) => item.accessorKey === obj.accessorKey)) {
        acc.push(obj);
      }
      return acc;
    }, []);

    // wyciągam unikalne nazwy accessorKey z przypisanych nowych kolumn
    const assignedUserNewColumns = uniqueObjects.map(
      (column) => column.accessorKey
    );

    const newFilteredSize = () => {
      const newSize = assignedUserNewColumns.reduce((acc, key) => {
        if (tableSettings[permissions]?.size.hasOwnProperty(key)) {
          // Dodaj istniejące klucze z checkDepartments
          acc[key] = tableSettings[permissions]?.size[key];
        } else {
          // Stwórz klucz, jeśli go nie ma, i ustaw wartość 100
          acc[key] = 100;
        }
        return acc;
      }, {});
      return newSize;
    };

    const newFilteredeOrder = () => {
      const checkOrder = tableSettings[permissions]?.order
        ? tableSettings[permissions].order
        : [];

      if (checkOrder.length) {
        const filteredOrder = checkOrder.filter(
          (item) =>
            assignedUserNewColumns.includes(item) || item === "mrt-row-spacer"
        );

        // Sprawdzamy, które elementy z `assignedUserNewColumns` są nowe (nie ma ich w `checkDepartments[0].tableSettings.order`)
        const newColumns = assignedUserNewColumns.filter(
          (item) => !tableSettings[permissions].order.includes(item)
        );

        // Znajdujemy indeks przedostatniego elementu (przed 'mrt-row-spacer')
        const indexBeforeSpacer = filteredOrder.indexOf("mrt-row-spacer");

        // Tworzymy nową tablicę, dodając nowe elementy przed ostatnim elementem ('mrt-row-spacer')
        const finalOrder = [
          ...filteredOrder.slice(0, indexBeforeSpacer), // Wszystkie elementy przed 'mrt-row-spacer'
          ...newColumns, // Dodajemy nowe elementy
          "mrt-row-spacer", // Zachowujemy 'mrt-row-spacer' na końcu
        ];
        return finalOrder;
      } else {
        const finalOrder = [...assignedUserNewColumns, "mrt-row-spacer"];
        return finalOrder;
      }
    };

    const newFilteredeVisible = () => {
      const newVisible = assignedUserNewColumns.reduce((acc, key) => {
        if (tableSettings[permissions]?.visible.hasOwnProperty(key)) {
          // Dodaj istniejące klucze z checkDepartments
          acc[key] = tableSettings[permissions]?.visible[key];
        } else {
          // Stwórz klucz, jeśli go nie ma, i ustaw wartość 100
          acc[key] = false;
        }
        return acc;
      }, {});
      return newVisible;
    };

    const newTableSettings = {
      size:
        tableSettings[permissions]?.size &&
        Object.keys(tableSettings[permissions]?.size).length > 0
          ? newFilteredSize()
          : {},
      order: tableSettings[permissions]?.order?.length
        ? newFilteredeOrder()
        : [],
      visible:
        tableSettings[permissions]?.visible &&
        Object.keys(tableSettings[permissions]?.visible).length > 0
          ? newFilteredeVisible()
          : {},
      pagination: tableSettings[permissions]?.pagination
        ? tableSettings[permissions].pagination
        : { pageIndex: 0, pageSize: 10 },
      pinning: tableSettings[permissions]?.pinning
        ? tableSettings[permissions].pinning
        : { left: [], right: [] },
    };

    columns[permissions] = uniqueObjects;
    tableSettings[permissions] = newTableSettings;

    await connect_SQL.query(
      "Update company_users SET columns = ?, tableSettings = ?  WHERE id_user = ?",
      [JSON.stringify(columns), JSON.stringify(tableSettings), id_user]
    );
  } catch (error) {
    logEvents(
      `tableController, verifyUserTableConfig: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// funkcja sprawdzająca poprzednie ustawienia tabeli użytkownika-zewnętrznego i dopasowująca nowe po zmianie dostępu do kancelarii
const verifyUserLawPartnerConfig = async (id_user, permission, lawPartner) => {
  try {
    if (!lawPartner.length) return;
    const [userData] = await connect_SQL.query(
      "SELECT departments, tableSettings, columns  FROM company_users WHERE id_user = ?",
      [id_user]
    );
    if (!userData.length) return;
    const { departments, tableSettings, columns } = userData[0];

    const [columnsFromSettings] = await connect_SQL.query(
      "SELECT * FROM company_table_columns WHERE EMPLOYEE = ?",
      [permission]
    );

    //  1️⃣ //  sprawdzam jakie kolumny powinny byc przypisane do usera
    const trueDepartments = departments[permission]
      .filter((obj) => Object.values(obj)[0] === true)
      .map((obj) => Object.keys(obj)[0]);

    const newUserColumns = columnsFromSettings.filter((col) =>
      col.AREAS.some(
        (area) => trueDepartments.includes(area.name) && area.available
      )
    );

    // sprawdzam czy nie ma duplikatów po id_table_columns:
    const uniqueUserColumns = [
      ...new Map(
        newUserColumns.map((col) => [col.id_table_columns, col])
      ).values(),
    ];

    const cleanedUserColumns = uniqueUserColumns.map((col) => ({
      accessorKey: col.ACCESSOR_KEY,
      header: col.HEADER,
      type: col.TYPE,
      filterVariant: col.FILTER_VARIANT,
    }));
    columns[permission] = [...cleanedUserColumns];

    // -- 2️⃣ dopsaowuje tableSetting po zmianie kolumn

    const allowedKeys = cleanedUserColumns.map((col) => col.accessorKey);
    // 📦 Pobierz ustawienia użytkownika
    const userSettings = tableSettings[permission] || {};

    // 🔧 Głęboka kopia (aby nie mutować oryginału)
    const cleanedSettings = JSON.parse(JSON.stringify(userSettings));

    // --- SIZE ---
    if (cleanedSettings.size) {
      if (allowedKeys.length === 0) {
        cleanedSettings.size = {};
      } else {
        cleanedSettings.size = Object.fromEntries(
          Object.entries(cleanedSettings.size).filter(([key]) =>
            allowedKeys.includes(key)
          )
        );
      }
    }

    // --- ORDER ---
    if (cleanedSettings.order) {
      if (allowedKeys.length === 0) {
        cleanedSettings.order = ["mrt-row-spacer"];
      } else {
        cleanedSettings.order = cleanedSettings.order.filter(
          (key) => key === "mrt-row-spacer" || allowedKeys.includes(key)
        );

        cleanedSettings.order = [
          ...cleanedSettings.order.filter((k) => k !== "mrt-row-spacer"),
          "mrt-row-spacer",
        ];
      }
    }

    // --- PINNING ---
    // 🔒 tu nic nie dodajemy, tylko usuwamy z oryginalnych ustawień
    if (cleanedSettings.pinning) {
      const { left = [], right = [] } = cleanedSettings.pinning;

      cleanedSettings.pinning = {
        left: left.filter((key) => allowedKeys.includes(key)),
        right: right.filter((key) => allowedKeys.includes(key)),
      };
    }

    // --- VISIBLE ---
    if (cleanedSettings.visible) {
      if (allowedKeys.length === 0) {
        cleanedSettings.visible = {};
      } else {
        cleanedSettings.visible = Object.fromEntries(
          Object.entries(cleanedSettings.visible).filter(([key]) =>
            allowedKeys.includes(key)
          )
        );
      }
    }

    // --- PAGINATION ---
    // nie zmieniamy

    tableSettings[permission] = cleanedSettings;

    await connect_SQL.query(
      "UPDATE company_users SET columns = ?, tableSettings = ? WHERE id_user = ?",
      [JSON.stringify(columns), JSON.stringify(tableSettings), id_user]
    );
  } catch (error) {
    logEvents(
      `tableController, verifyUserLawPartnerConfig: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// funkcja która ma zmienić ustawienia poszczególnych kolumn użytkownika, jeśli zostaną zmienione globalne ustawienia tej kolumny SQL
const changeTableColumns = async (req, res) => {
  const { type, permission, data } = req.body;
  try {
    if (type === "edit") {
      await connect_SQL.query(
        "UPDATE company_table_columns SET HEADER = ?, ACCESSOR_KEY = ?, FILTER_VARIANT = ?, TYPE = ?, EMPLOYEE = ?, AREAS = ? WHERE id_table_columns = ?",
        [
          data.header,
          data.accessorKey,
          data.filterVariant,
          data.type,
          data.employee,
          JSON.stringify(data.areas),
          data.id_table_columns,
        ]
      );
    } else if (type === "new") {
      await connect_SQL.query(
        "INSERT INTO company_table_columns  (HEADER, ACCESSOR_KEY, FILTER_VARIANT, TYPE, EMPLOYEE, AREAS) VALUES (?, ?, ?, ?, ?, ?)",
        [
          data.header,
          data.accessorKey,
          data.filterVariant,
          data.type,
          data.employee,
          JSON.stringify(data.areas),
        ]
      );
    }

    const [userTableColumns] = await connect_SQL.query(
      `SELECT id_user, columns, departments, tableSettings, permissions FROM company_users`
    );
    for (const user of userTableColumns) {
      if (
        permission === "Pracownik" &&
        user.permissions === "Pracownik" &&
        user.departments[permission]?.length
      ) {
        await verifyUserTableConfig(
          user.id_user,
          permission,
          user.departments[permission]
        );
      } else if (
        permission === "Kancelaria" &&
        user.departments["Kancelaria"]?.length
      ) {
        await verifyUserLawPartnerConfig(
          user.id_user,
          permission,
          user.departments["Kancelaria"]
        );
      }
    }

    res.end();
  } catch (error) {
    logEvents(
      `tableController, changeTableColumns: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const deleteTableColumn = async (req, res) => {
  const { id } = req.params;
  try {
    await connect_SQL.query(
      "DELETE FROM company_table_columns WHERE id_table_columns = ?",
      [id]
    );
    res.end();
  } catch (error) {
    logEvents(
      `tableController, deleteTableColumn: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// pobiera kolumny tabeli dla Ustawienia kolumn tabeli sql
const getTableColumns = async (req, res) => {
  try {
    const [columns] = await connect_SQL.query(
      "SELECT * FROM company_table_columns"
    );
    const [permissions] = await connect_SQL.query(
      "SELECT PERMISSIONS, EXT_COMPANY FROM company_settings WHERE id_setting = 1"
    );

    const grouped = permissions[0].PERMISSIONS.reduce((acc, role) => {
      acc[role] = {
        columns: columns
          .filter((col) => col.EMPLOYEE === role)
          .map((col) => ({
            id_table_columns: col.id_table_columns,
            header: col.HEADER,
            accessorKey: col.ACCESSOR_KEY,
            filterVariant: col.FILTER_VARIANT,
            type: col.TYPE,
            areas: col.AREAS,
            employee: col.EMPLOYEE,
          })),
      };
      return acc;
    }, {});

    const [areas] = await connect_SQL.query(
      "SELECT AREA FROM company_area_items"
    );
    const filteredAreas = areas.map((item) => item.AREA);

    grouped.Pracownik.areas = filteredAreas;
    grouped.Kancelaria.areas = permissions[0].EXT_COMPANY || [];
    res.json({
      permissions: permissions[0].PERMISSIONS || [],
      employees: grouped,
    });
  } catch (error) {
    logEvents(
      `tableController, getTableColumns: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// SQL pobieram  ustawienia tabeli(order, visiblility itd), kolumny
const getSettingsColumnsTable = async (req, res) => {
  const { id_user, user_type } = req.params;
  if (!id_user) {
    return res.status(400).json({ message: "Id and info are required." });
  }
  try {
    const [findUser] = await connect_SQL.query(
      "SELECT permissions, tableSettings, columns  FROM company_users WHERE id_user = ?",
      [id_user]
    );

    const tableSettings = findUser[0].tableSettings[user_type];
    const columns = findUser[0].columns[user_type];

    res.json({ tableSettings, columns });
  } catch (error) {
    logEvents(
      `tableController, getSettingsColumnsTable: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  prepareTableColumns,
  verifyUserTableConfig,
  verifyUserLawPartnerConfig,
  changeTableColumns,
  deleteTableColumn,
  getTableColumns,
  getSettingsColumnsTable,
};
