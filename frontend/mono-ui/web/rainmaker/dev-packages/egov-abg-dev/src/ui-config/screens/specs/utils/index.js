import { setRoute } from "egov-ui-framework/ui-redux/app/actions";
import { validate } from "egov-ui-framework/ui-redux/screen-configuration/utils";
import { getUserInfo } from "egov-ui-kit/utils/localStorageUtils";
import get from "lodash/get";
import { getQueryArg,getTransformedLocalStorgaeLabels ,getLocaleLabels} from "egov-ui-framework/ui-utils/commons";
import { handleScreenConfigurationFieldChange as handleField } from "egov-ui-framework/ui-redux/screen-configuration/actions";
import {
  getCommonCard,
  getCommonCaption
} from "egov-ui-framework/ui-config/screens/specs/utils";
import { httpRequest } from "../../../../ui-utils";
import {  prepareFinalObject } from "egov-ui-framework/ui-redux/screen-configuration/actions";
import { set } from "lodash";
import { downloadReceiptFromFilestoreID } from "egov-common/ui-utils/commons";
import commonConfig from "config/common.js";

export const getCommonApplyFooter = children => {
  return {
    uiFramework: "custom-atoms",
    componentPath: "Div",
    props: {
      className: "apply-wizard-footer"
    },
    children
  };
};

export const transformById = (payload, id) => {
  return (
    payload &&
    payload.reduce((result, item) => {
      result[item[id]] = {
        ...item
      };

      return result;
    }, {})
  );
};

export const getMdmsData = async  requestBody=> {
  try {
    const response = await httpRequest(
      "post",
      "egov-mdms-service/v1/_search",
      "_search",
      [],
      requestBody
    );
   
    return response;
  } catch (error) {
    console.log(error);
    return {};
  }
};

const getMdmsDataforCollection = async (businesService) => {
  let mdmsBody = null;

  if (businesService == "SW") {
    mdmsBody = {
      MdmsCriteria: {
        tenantId: "uk",
        moduleDetails: [
          {
            moduleName: "sw-services-calculation",
            masterDetails: [{ name: "Penalty" }],
          },
        ],
      },
    };
  } else {
    mdmsBody = {
      MdmsCriteria: {
        tenantId: "uk",
        moduleDetails: [
          {
            moduleName: "ws-services-calculation",
            masterDetails: [{ name: "Penalty" }],
          },
        ],
      },
    };
  }
  try {
    let payload = null;
    payload = await httpRequest(
      "post",
      "/egov-mdms-service/v1/_search",
      "_search",
      [],
      mdmsBody
    );
    if (
      payload.MdmsRes["ws-services-calculation"] &&
      payload.MdmsRes["ws-services-calculation"].Penalty !== undefined &&
      payload.MdmsRes["ws-services-calculation"].Penalty.length > 0
    ) {
      return payload.MdmsRes["ws-services-calculation"].Penalty[0].rate;
    } else if (
      payload.MdmsRes["sw-services-calculation"] &&
      payload.MdmsRes["sw-services-calculation"].Penalty !== undefined &&
      payload.MdmsRes["sw-services-calculation"].Penalty.length > 0
    ) {
      return payload.MdmsRes["sw-services-calculation"].Penalty[0].rate;
    }
  } catch (e) {
    console.log(e);
  }
};

export const downloadMultipleBill = async (
  bills = [],
  configKey,
  businesService
) => {
  let rate = await getMdmsDataforCollection(businesService);

  try {
    const DOWNLOADRECEIPT = {
      GET: {
        URL: "/pdf-service/v1/_create",
        ACTION: "_get",
      },
    };
    const queryStr = [
      { key: "key", value: configKey },
      { key: "tenantId", value: commonConfig.tenantId },
      { key: "isConsolidated", value: true }
    ];
    var addDetail = null;

    addDetail = {
      penaltyRate: rate,
    };
    bills = bills.filter((item) => item.totalAmount > 0);
    bills.map((item) => {
      item.additionalDetails = addDetail;
    });

    var actualBills = [],size = 80;
    for (let i = 0; bills.length > 0; i++) {
      actualBills.push(bills.splice(0, size));
    }
    for (let i = 0; i < actualBills.length; i++) {
      await downloadPdfs(DOWNLOADRECEIPT, queryStr, actualBills[i]);
    }
  } catch (error) {
    console.log(error);
  }
};

export const downloadPdfs = async (DOWNLOADRECEIPT, queryStr, bills) => {
  const pfResponse = await httpRequest(
    "post",
    DOWNLOADRECEIPT.GET.URL,
    DOWNLOADRECEIPT.GET.ACTION,
    queryStr,
    { Bill: bills },
    { Accept: "application/pdf" },
    { responseType: "arraybuffer" }
  );
  downloadReceiptFromFilestoreID(pfResponse.filestoreIds[0], "download");
};

export const getTranslatedLabel = (labelKey, localizationLabels) => {
  let translatedLabel = null;
  if (localizationLabels && localizationLabels.hasOwnProperty(labelKey)) {
    translatedLabel = localizationLabels[labelKey];
    if (
      translatedLabel &&
      typeof translatedLabel === "object" &&
      translatedLabel.hasOwnProperty("message")
    )
      translatedLabel = translatedLabel.message;
  }
  return translatedLabel || labelKey;
};

export const validateFields = (
  objectJsonPath,
  state,
  dispatch,
  screen = "apply"
) => {
  const fields = get(
    state.screenConfiguration.screenConfig[screen],
    objectJsonPath,
    {}
  );
  let isFormValid = true;
  for (var variable in fields) {
    if (fields.hasOwnProperty(variable)) {
      if (
        fields[variable] &&
        fields[variable].props &&
        (fields[variable].props.disabled === undefined ||
          !fields[variable].props.disabled) &&
        !validate(
          screen,
          {
            ...fields[variable],
            value: get(
              state.screenConfiguration.preparedFinalObject,
              fields[variable].jsonPath
            )
          },
          dispatch,
          true
        )
      ) {
        isFormValid = false;
      }
    }
  }
  return isFormValid;
};

export const convertDateToEpoch = (dateString, dayStartOrEnd = "dayend") => {
  //example input format : "2018-10-02"
  try {
    const parts = dateString.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    const DateObj = new Date(Date.UTC(parts[1], parts[2] - 1, parts[3]));
    DateObj.setMinutes(DateObj.getMinutes() + DateObj.getTimezoneOffset());
    if (dayStartOrEnd === "dayend") {
      DateObj.setHours(DateObj.getHours() + 24);
      DateObj.setSeconds(DateObj.getSeconds() - 1);
    }
    return DateObj.getTime();
  } catch (e) {
    return dateString;
  }
};

export const getEpochForDate = date => {
  const dateSplit = date.split("/");
  return new Date(dateSplit[2], dateSplit[1] - 1, dateSplit[0]).getTime();
};

export const sortByEpoch = (data, order) => {
  if (order) {
    return data.sort((a, b) => {
      return a[a.length - 1] - b[b.length - 1];
    });
  } else {
    return data.sort((a, b) => {
      return b[b.length - 1] - a[a.length - 1];
    });
  }
};

export const ifUserRoleExists = role => {
  let userInfo = JSON.parse(getUserInfo());
  const roles = get(userInfo, "roles");
  const roleCodes = roles ? roles.map(role => role.code) : [];
  if (roleCodes.indexOf(role) > -1) {
    return true;
  } else return false;
};

export const convertEpochToDate = dateEpoch => {
  if(dateEpoch == null || dateEpoch == undefined || dateEpoch == ''){
    return "NA" ;
  } 
  const dateFromApi = new Date(dateEpoch);
  let month = dateFromApi.getMonth() + 1;
  let day = dateFromApi.getDate();
  let year = dateFromApi.getFullYear();
  month = (month > 9 ? "" : "0") + month;
  day = (day > 9 ? "" : "0") + day;
  return `${day}/${month}/${year}`;
};

export const getCurrentFinancialYear = () => {
  var today = new Date();
  var curMonth = today.getMonth();
  var fiscalYr = "";
  if (curMonth > 3) {
    var nextYr1 = (today.getFullYear() + 1).toString();
    fiscalYr = today.getFullYear().toString() + "-" + nextYr1;
  } else {
    var nextYr2 = today.getFullYear().toString();
    fiscalYr = (today.getFullYear() - 1).toString() + "-" + nextYr2;
  }
  return fiscalYr;
};

export const getFinancialYearDates = (format, et) => {
  /** Return the starting date and ending date (1st April to 31st March)
   *  of the financial year of the given date in ET. If no ET given then
   *  return the dates for the current financial year */
  var date = !et ? new Date() : new Date(et);
  var curMonth = date.getMonth();
  var financialDates = { startDate: "NA", endDate: "NA" };
  if (curMonth > 3) {
    switch (format) {
      case "dd/mm/yyyy":
        financialDates.startDate = `01/04/${date.getFullYear().toString()}`;
        financialDates.endDate = `31/03/${(date.getFullYear() + 1).toString()}`;
        break;
      case "yyyy-mm-dd":
        financialDates.startDate = `${date.getFullYear().toString()}-04-01`;
        financialDates.endDate = `${(date.getFullYear() + 1).toString()}-03-31`;
        break;
    }
  } else {
    switch (format) {
      case "dd/mm/yyyy":
        financialDates.startDate = `01/04/${(
          date.getFullYear() - 1
        ).toString()}`;
        financialDates.endDate = `31/03/${date.getFullYear().toString()}`;
        break;
      case "yyyy-mm-dd":
        financialDates.startDate = `${(
          date.getFullYear() - 1
        ).toString()}-04-01`;
        financialDates.endDate = `${date.getFullYear().toString()}-03-31`;
        break;
    }
  }
  return financialDates;
};

export const gotoApplyWithStep = (state, dispatch, step) => {
  const applicationNumber = getQueryArg(
    window.location.href,
    "applicationNumber"
  );
  const applicationNumberQueryString = applicationNumber
    ? `&applicationNumber=${applicationNumber}`
    : ``;
  const applyUrl =
    process.env.REACT_APP_SELF_RUNNING === "true"
      ? `/egov-ui-framework/abg/apply?step=${step}${applicationNumberQueryString}`
      : `/abg/apply?step=${step}${applicationNumberQueryString}`;
  dispatch(setRoute(applyUrl));
};

export const showHideAdhocPopup = (state, dispatch) => {
  let toggle = get(
    state.screenConfiguration.screenConfig["search"],
    "components.adhocDialog.props.open",
    false
  );
  dispatch(
    handleField("search", "components.adhocDialog", "props.open", !toggle)
  );
};

export const getCommonGrayCard = children => {
  return {
    uiFramework: "custom-atoms",
    componentPath: "Container",
    children: {
      body: {
        uiFramework: "custom-atoms",
        componentPath: "Div",
        children: {
          ch1: getCommonCard(children, {
            style: {
              backgroundColor: "rgb(242, 242, 242)",
              boxShadow: "none",
              borderRadius: 0,
              overflow: "visible"
            }
          })
        },
        gridDefination: {
          xs: 12
        }
      }
    },
    gridDefination: {
      xs: 12
    }
  };
};

export const getLabelOnlyValue = (value, props = {}) => {
  return {
    uiFramework: "custom-atoms",
    componentPath: "Div",
    gridDefination: {
      xs: 6,
      sm: 4
    },
    props: {
      style: {
        marginBottom: "16px"
      },
      ...props
    },
    children: {
      value: getCommonCaption(value)
    }
  };
};


export const onActionClick = (rowData) =>{
  switch(rowData[8]){
    case "PAY" : return "";
    case "DOWNLOAD RECEIPT" : ""
    case "GENERATE NEW RECEIPT" : ""
  }
}

export const getTextToLocalMapping = label => {
  const localisationLabels = getTransformedLocalStorgaeLabels();
  switch (label) {
    case "Bill No.":
      return getLocaleLabels(
        "Bill No.",
        "ABG_COMMON_TABLE_COL_BILL_NO",
        localisationLabels
      );

    case "Consumer Name":
      return getLocaleLabels(
        "Consumer Name",
        "ABG_COMMON_TABLE_COL_CONSUMER_NAME",
        localisationLabels
      );

    case "Service Category":
      return getLocaleLabels(
        "Service Category",
        "ABG_COMMON_TABLE_COL_SERVICE_CATEGORY",
        localisationLabels
      );
    case "Bill Date":
      return getLocaleLabels(
        "Bill Date",
        "ABG_COMMON_TABLE_COL_BILL_DATE",
        localisationLabels
      );

    case "Bill Amount(Rs)":
      return getLocaleLabels(
        "Bill Amount(Rs)",
        "ABG_COMMON_TABLE_COL_BILL_AMOUNT",
        localisationLabels
      );

    case "Status":
      return getLocaleLabels(
        "Status",
        "ABG_COMMON_TABLE_COL_STATUS",
        localisationLabels
      );
    case "Action":
      return getLocaleLabels(
        "Action",
        "ABG_COMMON_TABLE_COL_ACTION",
        localisationLabels
      );

    case "Consumer ID":
      return getLocaleLabels(
        "Consumer ID",
        "ABG_COMMON_TABLE_COL_CONSUMER_ID",
        localisationLabels
      );

   case "Owner Name":
      return getLocaleLabels(
        "Owner Name",
        "ABG_COMMON_TABLE_COL_OWN_NAME",
        localisationLabels
      );

  case "Download":
      return getLocaleLabels(
        "Download",
        "ABG_COMMON_TABLE_COL_DOWNLOAD_BUTTON"
      );

    case "View button":
      return getLocaleLabels(
        "Action",
        "ABG_COMMON_TABLE_COL_VIEW_BUTTON",
        localisationLabels
      );

      case "ACTIVE":
      return getLocaleLabels(
        "Pending",
        "BILL_GENIE_ACTIVE_LABEL",
        localisationLabels
      );

      case "CANCELLED":
      return getLocaleLabels(
        "Cancelled",
        "BILL_GENIE_CANCELLED_LABEL",
        localisationLabels
      );

      case "PAID":
      return getLocaleLabels(
        "Paid",
        "BILL_GENIE_PAID_LABEL",
        localisationLabels
      );
      case "PAY":
      case "PARTIALLY PAID":
      return getLocaleLabels(
        "PAY",
        "BILL_GENIE_PAY",
        localisationLabels
      );
      case "EXPIRED":
      return getLocaleLabels(
        "Expired",
        "BILL_GENIE_EXPIRED",
        localisationLabels
      );
      case "GENERATE NEW BILL":
      return getLocaleLabels(
        "GENERATE NEW BILL",
        "BILL_GENIE_GENERATE_NEW_BILL",
        localisationLabels
      );

      case "DOWNLOAD RECEIPT":
        return getLocaleLabels(
          "DOWNLOAD RECEIPT",
          "BILL_GENIE_DOWNLOAD_RECEIPT",
          localisationLabels
        );
      case "Search Results for Bill":
        return getLocaleLabels(
          "Search Results for Bill",
          "BILL_GENIE_SEARCH_TABLE_HEADER",
          localisationLabels
        );
      case "PARTIALLY_PAID":
      case "PARTIALLY PAID":
        return getLocaleLabels(
            "Partially Paid",
            "BILL_GENIE_PARTIALLY_PAID",
            localisationLabels
          ); 
      case "BILL_GENIE_GROUP_SEARCH_HEADER" : 
          return getLocaleLabels(
            "Search Results for Group Bills",
            "BILL_GENIE_GROUP_SEARCH_HEADER",
            localisationLabels
          ); 
        default :
        return getLocaleLabels(
          "Search Results for Group Bills",
          label,
          localisationLabels
        ); 
  }
};


export const setServiceCategory = (businessServiceData, dispatch) => {
  let nestedServiceData = {};
  businessServiceData.forEach(item => {
    if (item.code && item.code.indexOf(".") > 0) {
      if (nestedServiceData[item.code.split(".")[0]]) {
        let child = get(
          nestedServiceData,
          `${item.code.split(".")[0]}.child`,
          []
        );
        child.push(item);
        set(nestedServiceData, `${item.code.split(".")[0]}.child`, child);
      } else {
        set(
          nestedServiceData,
          `${item.code.split(".")[0]}.code`,
          item.code.split(".")[0]
        );
        set(nestedServiceData, `${item.code.split(".")[0]}.child[0]`, item);
      }
    } else {
      set(nestedServiceData, `${item.code}`, item);
    }
  });
  dispatch(
    prepareFinalObject(
      "applyScreenMdmsData.nestedServiceData",
      nestedServiceData
    )
  );
  let serviceCategories = Object.values(nestedServiceData).filter(
    item => item.code
  );
  dispatch(
    prepareFinalObject(
      "applyScreenMdmsData.serviceCategories",
      serviceCategories
    )
  );
};
export const checkValueForNA = value => {
  return value == null || value == undefined || value == '' ? "NA" : value;
};
