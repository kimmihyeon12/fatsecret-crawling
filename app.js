const { createClient } = require("@supabase/supabase-js");
const puppeteer = require("puppeteer");

//url build patten으로 빼기

(async () => {
  init();
})();

async function init() {
  const url = "https://www.fatsecret.kr";

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
  });

  const page = await browser.newPage();

  await page.goto(url + "/Default.aspx?pa=brands&f=ㄱ&t=1");
  //모음 얻어오기
  const words = await getWords(url, browser, page);

  for (let i = 0; i < words.length; i++) {
    //마지막 페이지 번호 얻어오기
    const PageNumber = await getPageNumber(url, browser, page);

    for (let j = 0; j < PageNumber; j++) {
      console.log(`모음 ${words[i]} 페이지 번호${j + 1}`);

      await page.goto(
        url + `/Default.aspx?pa=brands&pg=${j}&f=${words[i]}&t=1`,
        {
          waitUntil: "networkidle2",
        }
      );

      //브랜드 href 얻어오기
      const brendHrefs = await getBrends(url, browser, page);
      for (let x = 0; x < brendHrefs.length; x++) {
        const page2 = await browser.newPage();
        await page2.goto(
          url + "/칼로리-영양소/search?q=" + brendHrefs[x].split("/")[2]
        );
        await page2.waitForTimeout(1000);

        let y = 0;
        while (true) {
          const isNestPage = await getNextPage(url, browser, page2);
          if (!isNestPage) break;
          await page2.goto(
            url +
              "/칼로리-영양소/search?q=" +
              brendHrefs[x].split("/")[2] +
              `&pg=${++y}`,
            {
              waitUntil: "networkidle2",
            }
          );
          const brendListHrefs = await getBrendList(url, browser, page2);
          for (let y = 0; y < brendListHrefs.length; y++) {
            try {
              const page3 = await browser.newPage();
              await page3.goto(url + brendListHrefs[y]);
              await page3.waitForTimeout(1000);
              const foodData = await getFoodData(url, browser, page3);
              await insertFood(foodData);
              await page3.close();
            } catch (e) {
              console.log(e);
              continue;
            }
          }
          await page2.waitForTimeout(1000);
        }
        await page2.close();
      }
    }
  }
}

async function getFoodData(url, browser, page) {
  const foodData = await page.evaluate(() => {
    const brend = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > div > div > table > tbody > tr > td > div:nth-child(2) > h2 > a"
    );
    const foodName = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > div > div > table > tbody > tr > td > div:nth-child(2) > h1"
    );
    const servingSize = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > table > tbody > tr > td.factPanel > div.nutrition_facts.international > div.serving_size.black.serving_size_value"
    );
    const kcal = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > table > tbody > tr > td.details > div > table:nth-child(2) > tbody > tr > td:nth-child(1) > div.factValue"
    );
    const province = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > table > tbody > tr > td.details > div > table:nth-child(2) > tbody > tr > td:nth-child(3) > div.factValue"
    );
    const carbohydrate = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > table > tbody > tr > td.details > div > table:nth-child(2) > tbody > tr > td:nth-child(5) > div.factValue"
    );
    const protein = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > table > tbody > tr > td.details > div > table:nth-child(2) > tbody > tr > td:nth-child(7) > div.factValue"
    );
    const sugar = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > table > tbody > tr > td.factPanel > div.nutrition_facts.international > div:nth-child(18)"
    );
    const Cholesterol = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > table > tbody > tr > td.factPanel > div.nutrition_facts.international > div:nth-child(33)"
    );
    const Sodium = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > table > tbody > tr > td.factPanel > div.nutrition_facts.international > div:nth-child(36)"
    );
    let foodData = {
      brend: "",
      foodName: "",
      size: 0,
      sizeUnit: "",
      kcal: 0,
      province: 0,
      carbohydrate: 0,
      protein: 0,
      sugar: 0,
      Cholesterol: 0,
      Sodium: 0,
    };

    if (brend) {
      foodData.brend = brend.innerHTML;
    }
    if (foodName) {
      foodData.foodName = foodName.innerHTML;
    }
    if (kcal) {
      foodData.kcal = Number(kcal.innerHTML);
    }
    if (servingSize) {
      const regex = /(\d+)\s*(ml|g)/gi;
      while ((matched = regex.exec(servingSize.innerHTML)) !== null) {
        try {
          foodData.size = matched[1];
          foodData.sizeUnit = matched[2];
        } catch (e) {
          continue;
        }
      }
    }
    if (province) {
      foodData.province = Number(province.innerHTML.split("g")[0]);
    }
    if (carbohydrate) {
      foodData.carbohydrate = Number(carbohydrate.innerHTML.split("g")[0]);
    }
    if (protein) {
      foodData.protein = Number(protein.innerHTML.split("g")[0]);
    }
    if (sugar) {
      foodData.sugar = Number(sugar.innerHTML.split("g")[0]);
    }
    if (Cholesterol) {
      foodData.Cholesterol = Number(Cholesterol.innerHTML.split("mg")[0]);
    }
    if (Sodium) {
      foodData.Sodium = Number(Sodium.innerHTML.split("mg")[0]);
    }

    return Promise.resolve(foodData);
  });

  return foodData;
}

async function getBrendList(url, browser, page) {
  const brendListHrefs = await page.evaluate(() => {
    const elememts = document.querySelectorAll(
      "#content > table > tbody > tr > td.leftCell > div > table > tbody > tr > td > a.prominent"
    );
    let hrefs = [];
    for (let i = 0; i < elememts.length; i++) {
      hrefs.push(elememts[i].getAttribute("href"));
    }
    return Promise.resolve(hrefs);
  });
  return brendListHrefs;
}

async function getBrends(url, browser, page) {
  const brendHrefs = await page.evaluate(() => {
    const elememts = document.querySelectorAll(
      "#content > table > tbody > tr > td.leftCell > div > h2 > a"
    );
    let hrefs = [];
    for (let i = 0; i < elememts.length; i++) {
      hrefs.push(elememts[i].getAttribute("href"));
    }
    return Promise.resolve(hrefs);
  });
  return brendHrefs;
}

async function getNextPage(url, browser, page) {
  const pageHrefs = await page.evaluate(() => {
    const next = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > div.searchResultsPaging > span.next > a"
    );
    if (next) {
      return Promise.resolve(true);
    } else {
      return Promise.resolve(false);
    }
  });

  return pageHrefs;
}

async function getWords(url, browser, page) {
  const wordTexts = await page.evaluate(() => {
    const words = document.querySelectorAll(
      "#content > table > tbody > tr > td.leftCell > div > div:nth-of-type(4) > a"
    );
    let wordTexts = [];
    for (let i = 0; i < words.length; i++) {
      wordTexts.push(words[i].innerHTML);
    }
    return Promise.resolve(wordTexts);
  });
  return wordTexts;
}

async function getPageNumber(url, browser, page) {
  const pageHrefs = await page.evaluate(() => {
    const next = document.querySelector(
      "#content > table > tbody > tr > td.leftCell > div > div.searchResultsPaging > span > a"
    );
    if (next) {
      return Promise.resolve(next.getAttribute("href"));
    } else {
      return Promise.resolve();
    }
  });

  if (pageHrefs) {
    await page.goto(url + pageHrefs);
  }

  const lastText = await page.evaluate(() => {
    const next = document.querySelectorAll(
      "#content > table > tbody > tr > td.leftCell > div > div.searchResultsPaging > a"
    );
    return Promise.resolve(next[next.length - 1].innerHTML);
  });

  return lastText;
}

async function insertFood(foodData) {
  const SUPABASE_URL = "https://fgdmshukfwsazghagfcy.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZnZG1zaHVrZndzYXpnaGFnZmN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE2Nzk2MzY4OTUsImV4cCI6MTk5NTIxMjg5NX0.wM31tN0WOGBPQDA8wfucP6GGexDNbtuVsHeon5ajO40";

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { data, error } = await supabase.from("food").insert(foodData);

  if (error) {
    console.error("Error inserting data:", error);
  } else {
    console.log("Data inserted:", data);
  }
}
