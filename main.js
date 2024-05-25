const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const pgp = require("pg-promise")();
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
// const db = pgp("postgres://postgres:vardast@1234@94.182.180.138:5432/vardast");   //stage
// const db = pgp("postgres://postgres:vardast@1234@128.140.109.3:5432/vardast");
const db = pgp("postgres://postgres:vardast@1234@94.182.180.138:5432/vardast");   //.com
// const db = pgp("postgres://postgres:vardast@1234@5.9.251.84:5432/vardast");   //.stage

const db_bot = pgp("postgres://user:password@78.46.124.237:5432/price");
const inputFolder = "./input";
const outputFolder = "./output";
const notExists = "./notSimilar";

const csvFiles = fs
  .readdirSync(inputFolder)
  .filter((file) => path.extname(file).toLowerCase() === ".csv");


// ========================================================
function extractPersianWords(text, sliceNumber = 3) {
  const persianString = text?.replaceAll(/[^\u0600-\u06FF ]/g, '')?.replaceAll(/\s+/g, ' ');
  const words = persianString?.split(' ')?.slice(0, sliceNumber).join(' ');
  return words;
}


async function findCategoryNameInDb(categoryName, productName) {
  try {

    // ===========================
    const query = 'select * from base_taxonomy_categories btc where btc."title"=$1';
    const category = await db.oneOrNone(query, [categoryName]);
    if (category) {
      return category?.title || ''
    }


    // ===========================
    const persianProductName3 = extractPersianWords(productName, 3);
    const query_2 = `
            select * from base_taxonomy_categories btc 
            where btc.id in (select "categoryId" from products where "name" LIKE $1 limit 1)
            limit 1
        `
    const category_2 = await db.oneOrNone(query_2, [`%${persianProductName3}%`]);
    if (category_2) {
      return category_2?.title || ''
    }


    // ===========================
    const persianProductName2 = extractPersianWords(productName, 2);
    const query_3 = `
            select * from base_taxonomy_categories btc 
            where btc.id in (select "categoryId" from products where "name" LIKE $1 limit 1)
            limit 1
        `
    const category_3 = await db.oneOrNone(query_3, [`%${persianProductName2}%`]);
    if (category_3) {
      return category_3?.title || ''
    }


    // ===========================
    if (categoryName?.trim() != '') {
      const query_4 = 'select * from base_taxonomy_categories btc where btc."title" like $1 limit 1';
      const category_4 = await db.oneOrNone(query_4, [`%${categoryName}%`]);
      if (category_4) {
        return category_4?.title || ''
      }
    }

    // ===========================
    if (categoryName?.trim() != '') {
      const categoryName3 = extractPersianWords(categoryName, 3);
      const query_5 = 'select * from base_taxonomy_categories btc where btc."title" like $1 limit 1';
      const category_5 = await db.oneOrNone(query_5, [`%${categoryName3}%`]);
      if (category_5) {
        return category_5?.title || ''
      }
    }

    // ===========================
    if (categoryName?.trim() != '') {
      const categoryName2 = extractPersianWords(categoryName, 2);
      const query_6 = 'select * from base_taxonomy_categories btc where btc."title" like $1 limit 1';
      const category_6 = await db.oneOrNone(query_6, [`%${categoryName2}%`]);
      if (category_6) {
        return category_6?.title || ''
      }
    }

    return '';
  } catch (error) {
    console.log(error);
    return "";
  }
}


// ========================================================
const getSemanticSimilarityWithNumber = async (
  str1,
  str2,
  maxRetries = 5,
  initialDelay = 3000,
  baseSimilarityWeight = 0.5
) => {
  let retries = 0;
  const delay = initialDelay;

  try {
    const numericValues1 = extractNumericValues(str1);
    const numericValues2 = extractNumericValues(str2);

    const commonNumericValues = numericValues1.filter((value1) =>
      numericValues2.includes(value1)
    );
    const maxNumericLength = Math.min(
      numericValues1.length,
      numericValues2.length
    );

    if (str1 == str2) {
      return 1;
    }
    if (maxNumericLength === 0 && str1 === str2) {
      return 1;
    }

    const similarity = commonNumericValues.length / maxNumericLength;
    return similarity || 0;
  } catch (error) {
    // Handle errors and retries if necessary
    console.error("Error:", error);
    retries += 1;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
};

function extractNumericValues(str) {
  const numericValues = str.match(/[۰-۹0-9]+/g) || [];
  return numericValues.map((value) => convertToNumeric(value));
}

function convertToNumeric(value) {
  const numericMap = {
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9",
  };
  const convertedValue =
    value.replace(/[۰-۹]/g, (match) => {
      const numeric = numericMap[match];
      return numeric;
    }) || value;
  return convertedValue;
}

const extractBrandAndSellerID = (csvFileName) => {
  const [brandID, sellerID, currency] = csvFileName
    .replace(".csv", "")
    .split("-");
  return [brandID, sellerID, currency];
};

const processCSVFile = async (csvFile) => {
  try {
    const csvFilePath = path.join(inputFolder, csvFile);
    const [brandID, sellerID, currency] = extractBrandAndSellerID(csvFile);

    console.log("Processing CSV file:", csvFile);
    console.log("BrandID:", brandID);
    console.log("SellerID:", sellerID);
    console.log("Currency:", currency);

    const outputFilePath = path.join(outputFolder, `${csvFile}`);
    const csvStream = fs.createReadStream(csvFilePath).pipe(csv());

    // Convert csvStream to an array to make it iterable
    const csvData = [];
    for await (const row of csvStream) {
      csvData.push(row);
    }

    const filePath = path.join(inputFolder, csvFile);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath, { recursive: true });

      console.log(`Deleted CSV file: ${csvFile}`);
    } else {
      process.exit(0);
    }

    // Process the CSV data
    await processChunk(
      csvData,
      db,
      db_bot,
      brandID,
      sellerID,
      currency,
      outputFilePath,
      csvFilePath
    );
    
  } catch (error) {
    console.error("Error processing CSV file:", csvFile);
    console.error(error.message || error);
  }
};

// Process CSV files sequentially
(async () => {
  if (!csvFiles) {
    await new Promise((resolve) => setTimeout(resolve, 3000000));
  }

  for (const csvFile of csvFiles) {
    await processCSVFile(csvFile)
      .then(() => { })
      .finally(() => { });
  }
})();

function extractUrl(jsonString) {
  let url = '';
  try {
    const startIndex = jsonString.indexOf('https://');
    if (startIndex == -1) {
      return '';
    }
    const endIndex = jsonString.indexOf(',', startIndex)
    url = jsonString.slice(startIndex, endIndex - 1);
    return url;
  } catch {
    return ''
  }
}

async function processChunk(
  chunk,
  db,
  db_bot,
  brandID,
  sellerID,
  currency,
  csvFilePath
) {
  const similarRows = [];
  const notSimilarRows = [];

  let i = 0;
  for (const row of chunk) {
    let maxSimilarityScore = 0;
    let mostSimilarProduct = null;
    i++;
    console.log("=================================", i);

    const productName = row["name"];
    let similarProducts = [];

    similarProducts = await findSimilarProducts(brandID, productName);

    if (similarProducts) {
      for (const product of similarProducts) {
        const similarityScore = await getSemanticSimilarityWithNumber(
          productName,
          product.name
        );

        if (similarityScore > maxSimilarityScore) {
          maxSimilarityScore = similarityScore;
          mostSimilarProduct = product;
        }
      }
      try {
        if (maxSimilarityScore >= 0.9) {
          // const createProductOfferQuery = `
          //   INSERT INTO bot_price ("productid", "sellerid", "url", "price_xpath", "name", "namev", "currency","sku","skuv")
          //   VALUES ($1, $2, $3, $4, $5, $6 , $7 , $8,$9)
          //   RETURNING *;
          // `;
          // let xpath = "";
          // if (currency == "01" || currency == "02") {
          //   xpath = row["xpath"];
          // }
          // let urlKey;
          // for (const key in row) {
          //   if (key.toLowerCase().includes("url")) {
          //     urlKey = key;
          //     break;
          //   }
          // }

          // // Access the URL property using the found key
          // const url = row[urlKey];
          // await db_bot.one(createProductOfferQuery, [
          //   mostSimilarProduct.id,
          //   sellerID,
          //   url,
          //   xpath,
          //   productName,
          //   mostSimilarProduct.name,
          //   currency == "01" ? true : false,
          //   row["SKU"],
          //   mostSimilarProduct.sku,
          // ]);


          // extract url
          let stringRow = JSON.stringify(row)
          const url = extractUrl(stringRow)

          x = {}
          x['id'] = ''
          x['sellerid'] = sellerID
          x['productid'] = mostSimilarProduct.id;
          x['brandid'] = mostSimilarProduct.brandId;
          x['url'] = url;
          x['price_xpath'] = row['xpath'];
          x['name'] = row['name'] || row['نام'];
          x['namev'] = mostSimilarProduct.name;
          x['sku'] = row['SKU'] || row['sku'];
          x['skuv'] = mostSimilarProduct.sku;
          x['currency'] = currency == "01" ? true : false,

            console.log("find similar :", x['name']);
          similarRows.push(x);
        } else {
          row['categoryAi'] = await findCategoryNameInDb(row['category'], row['name']);
          notSimilarRows.push(row);
          console.log("No similar product found for:", productName);
        }
      } catch (error) {
        console.error("Error:", error.message || error);
      } finally {
      }
    } else {
      row['categoryAi'] = await findCategoryNameInDb(row['category'], row['name']);
      notSimilarRows.push(row);
      console.log("No similar products found");
    }
  }

  // add existing products in stage to rowToKeep
  // const existingIds = similarRows.filter(product => {
  // if (product.id) {
  //     return true;
  // }
  // return false
  // }).map(p => p.id)

  // const products = await findAllProductsByBrandId(brandID);
  // for (let i = 0; i < products.length; i++){
  //   const product = products[i];
  //   if (!existingIds.includes(product.id)) {
  //     const emptyRow = createEmptyRow(similarRows[0]);
  //     emptyRow['SKU'] = product.sku
  //     emptyRow['id'] = product.id;
  //     emptyRow['nameV'] = product.name;

  //     console.log("Pushed Row: ", emptyRow);
  //     similarRows.push(emptyRow);
  //   }
  // }

  // // find price
  // try {
  //   for (let i = 0; i < similarRows.length; i++){
  //     const product = similarRows[i];
  //     const id = product['id'];
  //     if (id) {
  //       similarRows[i]['price'] = await findPrice(id);
  //       console.log(`price-${id}`, similarRows[i]['price']);
  //     }
  //   }
  // } catch (error) {
  //   console.log("Error in find price");
  // }


  // exists write
  const outputFilePath = path.join(outputFolder, path.basename(csvFilePath));
  const csvWriter = createCsvWriter({
    path: outputFilePath,
    header:
      similarRows.length > 0
        ? Object.keys(similarRows[0]).map((column) => ({
          id: column,
          title: column,
        }))
        : [],
  });
  await csvWriter.writeRecords(similarRows);

  // not exists write
  const notExistsFilePath = path.join(notExists, path.basename(csvFilePath));
  const csvWriter2 = createCsvWriter({
    path: notExistsFilePath,
    header:
      notSimilarRows.length > 0
        ? Object.keys(notSimilarRows[0]).map((column) => ({
          id: column,
          title: column,
        }))
        : [],
  });
  await csvWriter2.writeRecords(notSimilarRows);
}


async function findPrice(id) {
  if (id) {
    const prices = await db.any(
      'select amount from product_prices where "productId" = $1',
      [id]
    );
    const priceString = prices.map(price => price.amount).join('\n');
    return priceString
  }
  return "";
}


function createEmptyRow(row) {
  const emptyRow = {};
  Object.keys(row).map((key) => emptyRow[key] = "");
  return emptyRow;
}


async function findAllProductsByBrandId(brandId) {
  const products = await db.any(
    'select id, name, sku, "brandId" from products where "brandId" = $1',
    [brandId]
  );
  return products
}

// "brandId"
async function findSimilarProducts(brandID, productName) {
  try {

    let similarProductsExactMatch = null;
    similarProductsExactMatch = await db.oneOrNone(
      'SELECT id, name, sku, "brandId" FROM products WHERE name = $1',
      [productName]
    );

    if (similarProductsExactMatch) {
      return [similarProductsExactMatch];
    }

    const name = convertToNumeric(productName);
    similarProductsExactMatch = await db.oneOrNone(
      'SELECT id, name, sku, "brandId" FROM products WHERE name = $1',
      [name]
    );

    if (similarProductsExactMatch) {
      return [similarProductsExactMatch];
    }


    let similarProductsPartialMatch = null;
    similarProductsPartialMatch = await db.any(
      'SELECT id, name, sku, "brandId", SIMILARITY($2, name) AS similarity_score FROM products WHERE "brandId" = $1 AND name % $2 ORDER BY similarity_score DESC LIMIT 5',
      [brandID, name]
    );

    similarProductsPartialMatch = await db.any(
      'SELECT id, name, sku, "brandId", SIMILARITY($2, name) AS similarity_score FROM products WHERE name % $2 ORDER BY similarity_score DESC LIMIT 5',
      [brandID, name]
    );

    return similarProductsPartialMatch;
  } catch (error) {
    console.error("Error finding similar products:", error);
    throw error; // Rethrow the error for further handling
  }
}
