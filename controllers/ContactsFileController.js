const Contact = require('../model/Contact');
const { read, utils } = require('xlsx');
const { logEvents } = require('../middleware/logEvents');

// isExcelFile sprawdza czy plik jest naprawdę w frmacie excel (zabezpiecza przed podmianą rozszerzenia na xlsx)
const isExcelFile = (data) => {
    const excelSignature = [0x50, 0x4B, 0x03, 0x04];
    for (let i = 0; i < excelSignature.length; i++) {
        if (data[i] !== excelSignature[i]) {
            return false;
        }
    }
    return true;
};

const addNewEmails = (file, db) => {
    const newEmails = [...file, ...db];
    return newEmails;
};

const addNewPhones = (file, db) => {
    const newPhones = [...file, ...db];
    return newPhones;
};

// funkcja uzupełnia maile i numery telefonów w już istniejącym kontakcie w bazie
const addMailAndPhoneToExistingData = async (data, info) => {
    let result = null;
    if (info === "NIP") {
        result = await Contact.findOne({ NIP: data.NIP });
    }
    else if (info === "nameWithoutNIP") {
        result = await Contact.findOne({ name: data.name });
    }
    const newEmailsFromFile = data.emails.length ? data.emails.split(';').map((email) => email.trim()) : [];
    const emailsFromDB = result.emails.map(mail => { return mail.email; });
    const id = result._id;
    try {
        if (newEmailsFromFile.length) {
            const newEmails = addNewEmails(newEmailsFromFile, emailsFromDB);
            const filteredNewEmails = newEmails.filter(item => !emailsFromDB.includes(item));
            if (filteredNewEmails.length) {
                const completeEmails = filteredNewEmails.map(mail => {
                    return {
                        email: mail,
                        verify: data.verify ? true : false
                    };
                });
                await Contact.updateOne(
                    { _id: id },
                    { $push: { emails: { $each: completeEmails } } }
                );
            }
        }
        const newPhonesFromFile = data.phones.length ? data.phones.split(';').map((phone) => phone.trim()) : [];
        const newPhonesNumber = newPhonesFromFile.map(item => { return Number(item); });
        const phonesFromDB = result.phones.map(phone => { return phone.phone; });

        if (newPhonesFromFile.length) {
            const newPhones = addNewPhones(newPhonesNumber, phonesFromDB);
            const filteredNewPhones = newPhones.filter(item => !phonesFromDB.includes(item));
            if (filteredNewPhones.length) {
                const completePhones = filteredNewPhones.map(phone => {
                    return {
                        phone: phone,
                        verify: data.verify ? true : false
                    };
                });
                await Contact.updateOne(
                    { _id: id },
                    { $push: { phones: { $each: completePhones } } }
                );
            }
        }
    }
    catch (error) {
        logEvents(`contactsFileController, addMailAndPhoneToExistingData: ${error}`, 'reqServerErrors.txt');
        console.error(error);
    }
};

// funkcja dodaje nowy kontakt do bazy po wcześniejszym sprawdzeniu czy nie dubluje się NIP, a jezli kontakt nie ma NIP to czy nie dubluje się nazwa 
const addNewDataToDataBase = async (data) => {
    try {
        if (data.emails.length) {
            const emails = data.emails.split(';').map((email) => email.trim());
            data.emails = emails.map(email => {
                return {
                    email,
                    verify: data.verify ? true : false
                };
            });
        } else {
            data.emails = [];
        }
        if (data.phones.length) {
            const phones = data.phones.split(';').map((phone) => phone.trim());
            data.phones = phones.map(phone => {
                return {
                    phone: Number(phone),
                    verify: data.verify ? true : false
                };
            });
        } else {
            data.phones = [];
        }

        delete data.verify;
        await Contact.create(data);
    } catch (error) {
        logEvents(`contactsFileController, addNewDataToDataBase: ${error}`, 'reqServerErrors.txt');
        console.error(error);
    }
};

const addManyContactsFromExcel = async (req, res) => {

    try {
        const buffer = req.file.buffer;
        const data = new Uint8Array(buffer);

        if (!isExcelFile(data)) {
            return res.status(500).json({ error: "Nieprawidłowy plik" });
        }

        const workbook = read(buffer, { type: 'buffer' });
        const workSheetName = workbook.SheetNames[0];
        const workSheet = workbook.Sheets[workSheetName];

        // sprawdzenie czy dany kontakt (wiersz w excel) jest już w bazie danych
        const rows = utils.sheet_to_json(workSheet, { header: 0 });
        for (const row of rows) {
            const processedContact = {
                name: row.name,
                emails: row.email ? String(row.email) : [],
                phones: row.phone ? String(row.phone) : [],
                NIP: row.NIP || null,
                comment: row.comment || null,
                mailing: {
                    time: 3,
                    sending: row.comment ? false : true
                },
                verify: row.verify ? true : false
            };

            let checkNewContact = false;
            if (processedContact.NIP) {
                const resultEmail = await Contact.findOne({ NIP: processedContact.NIP });
                if (!resultEmail) {
                    checkNewContact = true;
                } else {
                    await addMailAndPhoneToExistingData(processedContact, "NIP");
                }
            }

            if (processedContact.name && !processedContact.NIP) {
                const resultEmail = await Contact.findOne({ name: processedContact.name });
                if (!resultEmail) {
                    checkNewContact = true;
                } else {
                    await addMailAndPhoneToExistingData(processedContact, "nameWithoutNIP");
                }
            }

            if (checkNewContact) {
                await addNewDataToDataBase(processedContact);
            }
        }
        res.status(200).json({ message: `Kontakty zostały zaktualizowane.` });

    } catch (error) {
        logEvents(`contactsFileController, addManyContactsFromExcel: ${error}`, 'reqServerErrors.txt');
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    addManyContactsFromExcel
};
