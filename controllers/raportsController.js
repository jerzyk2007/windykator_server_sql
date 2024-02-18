const Document = require('../model/Document');
const User = require('../model/User');
const { read, utils } = require('xlsx');

// pobiera dane do tabeli w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_
const getDataRaport = async (req, res) => {
    const { _id } = req.params;
    let filteredData = [];
    try {
        const findUser = await User.find({ _id });
        const { roles, permissions, username, usersurname, departments } = findUser[0];
        const truePermissions = Object.keys(permissions).filter(permission => permissions[permission]);
        const trueDepartments = Array.from(departments.entries())
            .filter(([department, value]) => value)
            .map(([department]) => department);
        const ZATWIERDZIL = `${usersurname} ${username}`;
        const result = await Document.find({});

        //usuń rozliczone dokumenty
        filteredData = result.filter(item => item.DO_ROZLICZENIA !== 0);

        if (truePermissions[0] === "Basic") {
            const basicFiltered = filteredData.filter(item => item.DORADCA === ZATWIERDZIL);
            return res.json({ data: basicFiltered, permission: "Basic" });
        } else {
            const standardFiltered = filteredData.filter(item => trueDepartments.includes(item.DZIAL));
            return res.json({ data: standardFiltered, permission: "Standard" });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    getDataRaport
};