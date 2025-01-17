const db = require("../../model/index");
const sequelize = db.sequelize;
const User = db.users;
const AppError = require("../../utils/appError");

const { QueryTypes, DataTypes, BLOB } = require("sequelize");
const sendEmail = require("../../utils/email");
const sendTextEmail = require("../../utils/sendTextMessage");

exports.renderCreateBloodBank = async (req, res, next) => {
  const provinces = await sequelize.query(`SELECT * FROM provinces`, {
    type: QueryTypes.SELECT,
  });
  const bloodGroups = await sequelize.query(`SELECT * FROM bloodGroup`, {
    type: QueryTypes.SELECT,
  });
  res.render("bloodbank/createForm", { provinces, bloodGroups });
};
exports.renderHospitalLogin = async (req, res, next) => {
  res.render("bloodBank/hospitalLogin");
};

exports.hospitalLogin = async (req, res, next) => {
  const { hospitalId, hospitalPassword } = req.body;
  const hospital = await sequelize.query(
    `SELECT * FROM bloodBank WHERE hospitalId = ? AND hospitalPassword = ?`,
    {
      type: QueryTypes.SELECT,
      replacements: [hospitalId, hospitalPassword],
    }
  );

  if (hospital.length === 0)
    return res.render("error/pathError", {
      message: "Invalid Hospital Id or password",
      code: 400,
    });
  const cookieOptions = {
    expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: true,
  };
  res.cookie("hospitalId", hospitalId, cookieOptions);
  res.redirect(`/bloodBank/dashboard/${hospitalId}`);
};
exports.renderHospitalDashboard = async (req, res, next) => {
  const { id } = req.params;
  const hospital = await sequelize.query(
    `SELECT * FROM bloodBank WHERE hospitalId = ?`,
    {
      type: QueryTypes.SELECT,
      replacements: [id],
    }
  );
  var bloodGroup = await sequelize.query(
    `SELECT * FROM bloodGroups WHERE hospitalId = ?`,
    {
      type: QueryTypes.SELECT,
      replacements: [id],
    }
  );
  try {
    var bookAppointment = await sequelize.query(
      `SELECT * FROM bookAppointment WHERE bloodBank = ?`,
      {
        type: QueryTypes.SELECT,
        replacements: [id],
      }
    );
    // select the blodgroup table of this hospital
  } catch (error) {
    bookAppointment = [];
  }

  console.log(bloodGroup);
  res.render("bloodBank/dashboard", {
    hospital: hospital[0],
    bookAppointment,
    bloodGroup,
  });
};
exports.createBloodBank = async (req, res, next) => {
  const {
    name,
    address,
    phone,
    province,
    district,
    localLevel,
    email,
    bloodGroup,
    amount,
  } = req.body;

  const generateRandomBloodBankId = Math.floor(100000 + Math.random() * 900000);
  const hospitalId = "HOS_" + generateRandomBloodBankId;
  const generateRandomBloodBankPassword = Math.floor(
    100000 + Math.random() * 900000
  );

  const hospitalPassword = "PASS_" + generateRandomBloodBankPassword;
  if (!name || !phone || !province || !district || !localLevel || !email)
    return res.render("error/pathError", {
      message: "Please provide all fields",
      code: 400,
    });

  try {
    await sequelize.query(
      `CREATE TABLE  IF NOT EXISTS bloodBank(id INT NOT NUll AUTO_INCREMENT PRIMARY KEY,hospitalId VARCHAR(255) REFERENCES bloodGroups ON DELETE CASCADE ON UPDATE CASCADE ,name VARCHAR(255),address VARCHAR(255),phone VARCHAR(255),province VARCHAR(255),district VARCHAR(255),localLevel VARCHAR(255), email VARCHAR(255),bloodGroup VARCHAR(255) NULL,amount INT NULL ,hospitalPassword VARCHAR(255),createdAt DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      {
        type: QueryTypes.CREATE,
      }
    );
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS bloodGroups  (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,bloodGroup VARCHAR(255),amount INT,hospitalId VARCHAR(255) NULL
      )`,
      {
        type: QueryTypes.CREATE,
      }
    );
    await sequelize.query(
      `INSERT INTO bloodBank (hospitalId,name,address,phone,province,district,localLevel,email,bloodGroup,amount,hospitalPassword) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      {
        type: QueryTypes.INSERT,
        replacements: [
          hospitalId,
          name,
          address || null,
          phone,
          province,
          district,
          localLevel,
          email,
          bloodGroup || null,
          amount || null,
          hospitalPassword,
        ],
      }
    );

    await sequelize.query(
      `INSERT INTO bloodGroups (bloodGroup,amount,hospitalId) VALUES ( ' A+ ',0,'${hospitalId}' ),( ' A- ',0,'${hospitalId}' ),( ' B+ ',0,'${hospitalId}' ),( ' B- ',0,'${hospitalId}' ),( ' AB+ ',0,'${hospitalId}' ),( ' AB- ',0,'${hospitalId}' ),( ' O+ ',0,'${hospitalId}' ),( ' O- ',0,'${hospitalId}' )`,
      {
        type: QueryTypes.INSERT,
      }
    );
    req.flash("success", "Successfully made a new bloodBank!");
    const message = `Your hospital id is ${hospitalId} and password is ${hospitalPassword}`;

    await sendTextEmail({
      email: email,
      subject: "Your hosptal Login Credentials",
      message,
    });

    res.redirect("/bloodBank");
  } catch (error) {
    return res.render("error/pathError", { message: error, code: 400 });
  }
};

exports.getBloodBanks = async (req, res, next) => {
  const province = req.query.province;
  const district = req.query.district;
  const localLevel = req.query.localLevel;

  let bloodBanks;
  if (!province && !district && !localLevel) {
    // if no query parameters are provided, retrieve all users
    try {
      // bloodBanks = await sequelize.query(`SELECT * FROM bloodBank  `, {
      //   type: QueryTypes.SELECT,
      // });
      bloodBanks = await sequelize.query("SELECT * FROM bloodBank", {
        type: QueryTypes.SELECT,
      });
      const bloodGroups = await sequelize.query(`SELECT * FROM bloodGroups`, {
        type: QueryTypes.SELECT,
      });
      bloodBanks = bloodBanks.map((bloodBank) => {
        const bloodGroup = bloodGroups.filter(
          (bloodGroup) => bloodGroup.hospitalId === bloodBank.hospitalId
        );
        bloodBank.bloodGroup = bloodGroup;
        return bloodBank;
      });
    } catch (error) {
      bloodBanks = [];
    }
  } else if (!province && !district) {
    // if only the localLevel parameter is provided, filter by localLevel

    bloodBanks = await sequelize.query(
      `SELECT * FROM bloodBank WHERE localLevel='${localLevel}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
    const bloodGroups = await sequelize.query(`SELECT * FROM bloodGroups`, {
      type: QueryTypes.SELECT,
    });
    bloodBanks = bloodBanks.map((bloodBank) => {
      const bloodGroup = bloodGroups.filter(
        (bloodGroup) => bloodGroup.hospitalId === bloodBank.hospitalId
      );
      bloodBank.bloodGroup = bloodGroup;
      return bloodBank;
    });
  } else if (!province && !localLevel) {
    // if only the district parameter is provided, filter by district

    bloodBanks = await sequelize.query(
      `SELECT * FROM bloodBank WHERE district='${district}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
    const bloodGroups = await sequelize.query(`SELECT * FROM bloodGroups`, {
      type: QueryTypes.SELECT,
    });
    bloodBanks = bloodBanks.map((bloodBank) => {
      const bloodGroup = bloodGroups.filter(
        (bloodGroup) => bloodGroup.hospitalId === bloodBank.hospitalId
      );
      bloodBank.bloodGroup = bloodGroup;
      return bloodBank;
    });
  } else if (!district && !localLevel) {
    // if only the province parameter is provided, filter by province

    bloodBanks = await sequelize.query(
      `SELECT * FROM bloodBank WHERE province='${province}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
    const bloodGroups = await sequelize.query(`SELECT * FROM bloodGroups`, {
      type: QueryTypes.SELECT,
    });
    bloodBanks = bloodBanks.map((bloodBank) => {
      const bloodGroup = bloodGroups.filter(
        (bloodGroup) => bloodGroup.hospitalId === bloodBank.hospitalId
      );
      bloodBank.bloodGroup = bloodGroup;
      return bloodBank;
    });
  } else if (!province) {
    // if district and localLevel parameters are provided, filter by both

    bloodBanks = await sequelize.query(
      `SELECT * FROM bloodBank WHERE localLevel='${localLevel}' AND district='${district}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
    const bloodGroups = await sequelize.query(`SELECT * FROM bloodGroups`, {
      type: QueryTypes.SELECT,
    });
    bloodBanks = bloodBanks.map((bloodBank) => {
      const bloodGroup = bloodGroups.filter(
        (bloodGroup) => bloodGroup.hospitalId === bloodBank.hospitalId
      );
      bloodBank.bloodGroup = bloodGroup;
      return bloodBank;
    });
  } else if (!district) {
    // if province and localLevel parameters are provided, filter by both

    bloodBanks = await sequelize.query(
      `SELECT * FROM bloodBank WHERE localLevel='${localLevel}' AND province='${province}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
    const bloodGroups = await sequelize.query(`SELECT * FROM bloodGroups`, {
      type: QueryTypes.SELECT,
    });
    bloodBanks = bloodBanks.map((bloodBank) => {
      const bloodGroup = bloodGroups.filter(
        (bloodGroup) => bloodGroup.hospitalId === bloodBank.hospitalId
      );
      bloodBank.bloodGroup = bloodGroup;
      return bloodBank;
    });
  } else if (!localLevel) {
    // if province and district parameters are provided, filter by both

    bloodBanks = await sequelize.query(
      `SELECT * FROM bloodBank WHERE province='${province}' AND district='${district}'`,
      {
        type: QueryTypes.SELECT,
      }
    );
    const bloodGroups = await sequelize.query(`SELECT * FROM bloodGroups`, {
      type: QueryTypes.SELECT,
    });
    bloodBanks = bloodBanks.map((bloodBank) => {
      const bloodGroup = bloodGroups.filter(
        (bloodGroup) => bloodGroup.hospitalId === bloodBank.hospitalId
      );
      bloodBank.bloodGroup = bloodGroup;
      return bloodBank;
    });
  } else {
    // if all parameters are provided, filter by all

    bloodBanks = await sequelize.query(
      `SELECT * FROM bloodBank WHERE localLevel='${localLevel}' AND district='${district}' AND province='${province}'  `,
      {
        type: QueryTypes.SELECT,
      }
    );
    const bloodGroups = await sequelize.query(`SELECT * FROM bloodGroups`, {
      type: QueryTypes.SELECT,
    });
    bloodBanks = bloodBanks.map((bloodBank) => {
      const bloodGroup = bloodGroups.filter(
        (bloodGroup) => bloodGroup.hospitalId === bloodBank.hospitalId
      );
      bloodBank.bloodGroup = bloodGroup;
      return bloodBank;
    });
  }
  try {
    var provinces = await sequelize.query("SELECT * FROM provinces", {
      type: QueryTypes.SELECT,
    });
  } catch (error) {
    provinces = [];
  }
  if (!bloodBanks)
    return res.render("error/pathError", {
      message: "No bloodBank found",
      code: 400,
    });

  res.render("bloodBank/index", { bloodBanks, provinces });
};

exports.getBloodBank = async (req, res, next) => {
  const bloodBank = await sequelize.query(
    `SELECT * FROM bloodBank WHERE id = ?`,
    {
      type: QueryTypes.SELECT,
      replacements: [req.params.id],
    }
  );
  if (!bloodBank) {
    req.flash("error", "Cannot find that bloodBank!");

    return res.render("error", { message: "Not found with that id" });
  }
  res.render("bloodBank/showIndividual", { bloodBank });
};

exports.renderUpdateBloodBankForm = async (req, res, next) => {
  const hospitalId = req.cookies.hospitalId;
  console.log("hospitalId", hospitalId);
  const bloodBank = await sequelize.query(
    `SELECT * FROM bloodBank WHERE id = ?`,
    {
      type: QueryTypes.SELECT,
      replacements: [req.params.id],
    }
  );
  if (!bloodBank) {
    req.flash("error", "Cannot find that bloodBank!");

    return res.render("error", { message: "Not found with that id" });
  }
  res.render("bloodBank/updateForm", { bloodBank });
};
exports.updateBloodBank = async (req, res, next) => {
  const { name, address, phone } = req.body;
  await sequelize.query(
    `UPDATE bloodBank SET name=?,address=?,phone=? WHERE id = ?`,
    {
      type: QueryTypes.UPDATE,
      replacements: [name, address, phone, req.params.id],
    }
  );
  req.flash("success", "Successfully updated bloodBank!");

  res.redirect("/bloodBank");
};

exports.deleteBloodBank = async (req, res, next) => {
  await sequelize.query(`DELETE FROM bloodBank WHERE id=?`, {
    type: QueryTypes.DELETE,
    replacements: [req.params.id],
  });
  req.flash("success", "Successfully deleted bloodBank!");

  res.redirect("/bloodBank");
};

exports.renderAddBloodGroup = async (req, res, next) => {
  const bloodGroups = await sequelize.query("SELECT * FROM bloodGroup", {
    type: QueryTypes.SELECT,
  });

  res.render("bloodBank/createBloodGroup", { bloodGroups });
};

exports.addBloodGroup = async (req, res, next) => {
  try {
    const { bloodGroup, amount } = req.body;
    const hospitalId = req.cookies.hospitalId;

    await sequelize.query(
      `INSERT INTO bloodGroup_${hospitalId} (bloodGroup,amount,hospitalId) VALUES(?,?,?) `,
      {
        type: QueryTypes.INSERT,
        replacements: [bloodGroup, amount, hospitalId],
      }
    );
    res.redirect(`/bloodBank/dashboard/${hospitalId}`);
  } catch (error) {
    res.render("error/pathError", { message: error, code: 500 });
  }
};

exports.renderEditBloodGroup = async (req, res, next) => {
  const bloodGroups = await sequelize.query(
    `SELECT * FROM bloodGroups WHERE hospitalId=? `,
    {
      type: QueryTypes.SELECT,
      replacements: [req.cookies.hospitalId],
    }
  );
  console.log(bloodGroups);
  res.render("bloodBank/editBloodGroup", { bloodGroups });
};

exports.editBloodGroup = async (req, res, next) => {
  try {
    const { bloodGroup, amount } = req.body;
    const hospitalId = req.cookies.hospitalId;
    await sequelize.query(
      `UPDATE bloodGroups SET amount=? WHERE bloodGroup = ? AND hospitalId=?`,
      {
        type: QueryTypes.UPDATE,
        replacements: [amount, bloodGroup, hospitalId],
      }
    );

    res.redirect(`/bloodBank/dashboard/${hospitalId}`);
  } catch (error) {
    console.log(error);
    res.render("error/pathError", { message: error, code: 500 });
  }
};
