// const text = '{"URL":"https://deltalamp.com/product/classic-colored-lamp/","xpath":"","خصوصیات / ویژگی‌ها":"مدل : لامپ کلاسیک 10 وات رنگی\nتوان : 10 وات\nنوع : فو وق کم مصرف (LED)\nتعداد در کارتون : 100 عدد\nمیزان روشنایی : 1000 لومن\nنوع پایه : E27\nرده انرژی : A+\nولتاژ : 220/240 ولت\nفرکانس عملکرد : 50 هرتز","توضیحات":"","currency":"تومان","قیمت (تومان)":"","واحد اندازه‌گیری":"عدد","دسته‌بندی":"خانه > لامپ ال ای دی LED > لامپ کلاسیک","برند":"دلتا","SKU":"18a8e105904c44c38b864e5550505bde","name":"لامپ کلاسیک 10 و وات رنگی","ردیف":"2"}'



// function extractUrl(jsonString) {
//     let url = '';
//     const startIndex = jsonString.indexOf('https://');
//     if (startIndex == -1) {
//         return '';
//     }
//     const endIndex = jsonString.indexOf(',', startIndex)
//     url = jsonString.slice(startIndex, endIndex - 1);
//     return url;
// }

// const url = extractUrl(text)

// console.log(url);

const pgp = require("pg-promise")();
const db = pgp("postgres://postgres:vardast@1234@94.182.180.138:5432/vardast");   //.com


async function main() {
    let similarProductsExactMatch = null;
    similarProductsExactMatch = await db.any(
        'SELECT id, name, sku, "brandId" FROM products WHERE name = $1',
        ['گاز صفحه ای اخوان ونوس 29']
    );

    for (const product of similarProductsExactMatch) {
        console.log(product);
    }
    console.log(similarProductsExactMatch);
}

main(); 