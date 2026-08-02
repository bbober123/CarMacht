// Katalog startowy ~65 aut - kazdy model ma JEDEN przypisany rocznik
// (cyklicznie z YEARS, dla urozmaicenia), zero duplikatow.
// Uzywane przez admin.html do jednorazowego zaladowania katalogu startowego.
// Kolejne auta dodajesz juz przez panel admina, nie edytujac tego pliku.

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_MODELS = [
  { make: "Tesla", country: "USA", model: "Model 3", segment: "Sedan", pt: "electric", engine: "Silnik synchroniczny PM", kw: 260, nm: 493, accel: 5.6, top: 225, price: 42990, drv: "RWD" },
  { make: "Tesla", country: "USA", model: "Model Y", segment: "SUV", pt: "electric", engine: "Silnik synchroniczny PM", kw: 258, nm: 420, accel: 6.6, top: 217, price: 47740, drv: "AWD" },
  { make: "Tesla", country: "USA", model: "Model S", segment: "Sedan", pt: "electric", engine: "Podwojny silnik PM", kw: 493, nm: 830, accel: 3.1, top: 250, price: 74990, drv: "AWD" },
  { make: "Tesla", country: "USA", model: "Cybertruck", segment: "Pickup", pt: "electric", engine: "Potrojny silnik PM", kw: 480, nm: 1000, accel: 4.1, top: 209, price: 79990, drv: "AWD" },
  { make: "Ford", country: "USA", model: "Mustang Mach-E", segment: "SUV", pt: "electric", engine: "Silnik synchroniczny PM", kw: 216, nm: 430, accel: 6.1, top: 180, price: 42995, drv: "RWD" },
  { make: "Ford", country: "USA", model: "F-150 Lightning", segment: "Pickup", pt: "electric", engine: "Podwojny silnik PM", kw: 358, nm: 1050, accel: 4.5, top: 177, price: 54995, drv: "AWD" },
  { make: "Ford", country: "USA", model: "Explorer", segment: "SUV", pt: "combustion", engine: "2.3L EcoBoost Turbo I4", kw: 224, nm: 420, accel: 7.7, top: 200, price: 38105, drv: "AWD" },
  { make: "Ford", country: "USA", model: "Bronco", segment: "SUV", pt: "combustion", engine: "2.7L EcoBoost V6", kw: 246, nm: 475, accel: 6.5, top: 160, price: 39900, drv: "AWD" },
  { make: "Chevrolet", country: "USA", model: "Corvette Z06", segment: "Coupe sportowe", pt: "combustion", engine: "5.5L V8 Flat-Plane", kw: 493, nm: 623, accel: 2.6, top: 314, price: 111300, drv: "RWD" },
  { make: "Chevrolet", country: "USA", model: "Bolt EUV", segment: "SUV", pt: "electric", engine: "Silnik synchroniczny PM", kw: 150, nm: 360, accel: 7.0, top: 149, price: 27800, drv: "FWD" },
  { make: "Chevrolet", country: "USA", model: "Camaro", segment: "Coupe sportowe", pt: "combustion", engine: "6.2L V8", kw: 339, nm: 617, accel: 4.0, top: 290, price: 41400, drv: "RWD" },
  { make: "Jeep", country: "USA", model: "Wrangler 4xe", segment: "SUV", pt: "hybrid", engine: "2.0L Turbo PHEV", kw: 280, nm: 637, accel: 6.0, top: 180, price: 53295, drv: "AWD" },
  { make: "BMW", country: "Niemcy", model: "3 Series", segment: "Sedan", pt: "combustion", engine: "2.0L Turbo I4", kw: 190, nm: 400, accel: 6.6, top: 235, price: 44000, drv: "RWD" },
  { make: "BMW", country: "Niemcy", model: "M3 Competition", segment: "Sedan sportowy", pt: "combustion", engine: "3.0L S58 Twin-Turbo I6", kw: 375, nm: 650, accel: 3.9, top: 290, price: 76195, drv: "RWD" },
  { make: "BMW", country: "Niemcy", model: "X5", segment: "SUV", pt: "combustion", engine: "3.0L Turbo I6", kw: 250, nm: 450, accel: 6.1, top: 230, price: 65200, drv: "AWD" },
  { make: "BMW", country: "Niemcy", model: "i4", segment: "Sedan", pt: "electric", engine: "Silnik synchroniczny PM", kw: 250, nm: 430, accel: 5.7, top: 190, price: 52200, drv: "RWD" },
  { make: "Mercedes-Benz", country: "Niemcy", model: "C-Class", segment: "Sedan", pt: "combustion", engine: "2.0L Turbo I4", kw: 150, nm: 300, accel: 7.3, top: 210, price: 45000, drv: "RWD" },
  { make: "Mercedes-Benz", country: "Niemcy", model: "EQS", segment: "Sedan", pt: "electric", engine: "Silnik synchroniczny PM", kw: 245, nm: 565, accel: 6.2, top: 210, price: 104400, drv: "RWD" },
  { make: "Mercedes-Benz", country: "Niemcy", model: "GLE", segment: "SUV", pt: "hybrid", engine: "3.0L Turbo I6 + PHEV", kw: 280, nm: 500, accel: 6.1, top: 210, price: 61900, drv: "AWD" },
  { make: "Mercedes-Benz", country: "Niemcy", model: "AMG GT", segment: "Coupe sportowe", pt: "combustion", engine: "4.0L Twin-Turbo V8", kw: 470, nm: 700, accel: 3.2, top: 315, price: 137000, drv: "RWD" },
  { make: "Audi", country: "Niemcy", model: "A4", segment: "Sedan", pt: "combustion", engine: "2.0L TFSI Turbo I4", kw: 140, nm: 320, accel: 7.9, top: 213, price: 40900, drv: "AWD" },
  { make: "Audi", country: "Niemcy", model: "Q5", segment: "SUV", pt: "combustion", engine: "2.0L TFSI Turbo I4", kw: 195, nm: 370, accel: 6.3, top: 235, price: 45400, drv: "AWD" },
  { make: "Audi", country: "Niemcy", model: "e-tron GT", segment: "Sedan sportowy", pt: "electric", engine: "Podwojny silnik PM", kw: 350, nm: 630, accel: 4.1, top: 245, price: 104900, drv: "AWD" },
  { make: "Audi", country: "Niemcy", model: "RS6 Avant", segment: "Kombi sportowe", pt: "combustion", engine: "4.0L Twin-Turbo V8", kw: 441, nm: 800, accel: 3.6, top: 305, price: 122900, drv: "AWD" },
  { make: "Porsche", country: "Niemcy", model: "911 Carrera", segment: "Coupe sportowe", pt: "combustion", engine: "3.0L Flat-6 Twin-Turbo", kw: 283, nm: 450, accel: 4.2, top: 293, price: 114400, drv: "RWD" },
  { make: "Porsche", country: "Niemcy", model: "Taycan", segment: "Sedan sportowy", pt: "electric", engine: "Podwojny silnik PM", kw: 300, nm: 345, accel: 5.1, top: 230, price: 90900, drv: "RWD" },
  { make: "Porsche", country: "Niemcy", model: "Cayenne", segment: "SUV", pt: "combustion", engine: "3.0L Turbo V6", kw: 250, nm: 450, accel: 6.2, top: 245, price: 74500, drv: "AWD" },
  { make: "Porsche", country: "Niemcy", model: "Macan", segment: "SUV", pt: "combustion", engine: "2.0L Turbo I4", kw: 190, nm: 360, accel: 6.7, top: 223, price: 60900, drv: "AWD" },
  { make: "Volkswagen", country: "Niemcy", model: "Golf", segment: "Hatchback", pt: "combustion", engine: "1.5L TSI Turbo I4", kw: 110, nm: 250, accel: 9.2, top: 210, price: 24190, drv: "FWD" },
  { make: "Volkswagen", country: "Niemcy", model: "ID.4", segment: "SUV", pt: "electric", engine: "Silnik synchroniczny PM", kw: 150, nm: 310, accel: 8.5, top: 160, price: 38995, drv: "RWD" },
  { make: "Volkswagen", country: "Niemcy", model: "Tiguan", segment: "SUV", pt: "combustion", engine: "2.0L TSI Turbo I4", kw: 135, nm: 320, accel: 8.7, top: 205, price: 28995, drv: "AWD" },
  { make: "Toyota", country: "Japonia", model: "Corolla Hybrid", segment: "Hatchback", pt: "hybrid", engine: "1.8L I4 + silnik elektryczny", kw: 103, nm: 142, accel: 9.1, top: 180, price: 23100, drv: "FWD" },
  { make: "Toyota", country: "Japonia", model: "RAV4", segment: "SUV", pt: "hybrid", engine: "2.5L I4 + silnik elektryczny", kw: 163, nm: 221, accel: 7.7, top: 180, price: 31575, drv: "AWD" },
  { make: "Toyota", country: "Japonia", model: "Supra", segment: "Coupe sportowe", pt: "combustion", engine: "3.0L Turbo I6", kw: 285, nm: 500, accel: 4.1, top: 250, price: 55250, drv: "RWD" },
  { make: "Toyota", country: "Japonia", model: "bZ4X", segment: "SUV", pt: "electric", engine: "Silnik synchroniczny PM", kw: 150, nm: 265, accel: 7.5, top: 160, price: 42000, drv: "AWD" },
  { make: "Honda", country: "Japonia", model: "Civic", segment: "Sedan", pt: "combustion", engine: "1.5L Turbo I4", kw: 133, nm: 240, accel: 7.9, top: 200, price: 23950, drv: "FWD" },
  { make: "Honda", country: "Japonia", model: "CR-V", segment: "SUV", pt: "hybrid", engine: "2.0L I4 + silnik elektryczny", kw: 152, nm: 335, accel: 7.5, top: 180, price: 33350, drv: "AWD" },
  { make: "Mazda", country: "Japonia", model: "MX-5 Miata", segment: "Roadster", pt: "combustion", engine: "2.0L Skyactiv-G I4", kw: 135, nm: 205, accel: 6.5, top: 217, price: 29050, drv: "RWD" },
  { make: "Mazda", country: "Japonia", model: "CX-5", segment: "SUV", pt: "combustion", engine: "2.5L Skyactiv-G I4", kw: 142, nm: 252, accel: 8.5, top: 200, price: 28250, drv: "AWD" },
  { make: "Nissan", country: "Japonia", model: "Leaf", segment: "Hatchback", pt: "electric", engine: "Silnik synchroniczny PM", kw: 110, nm: 320, accel: 7.9, top: 157, price: 28140, drv: "FWD" },
  { make: "Nissan", country: "Japonia", model: "GT-R", segment: "Coupe sportowe", pt: "combustion", engine: "3.8L Twin-Turbo V6", kw: 419, nm: 632, accel: 2.9, top: 315, price: 115000, drv: "AWD" },
  { make: "Subaru", country: "Japonia", model: "Impreza", segment: "Hatchback", pt: "combustion", engine: "2.0L Flat-4", kw: 113, nm: 196, accel: 9.5, top: 195, price: 22995, drv: "AWD" },
  { make: "Subaru", country: "Japonia", model: "BRZ", segment: "Coupe sportowe", pt: "combustion", engine: "2.4L Flat-4", kw: 172, nm: 250, accel: 6.1, top: 220, price: 30195, drv: "RWD" },
  { make: "Hyundai", country: "Korea Płd.", model: "Ioniq 5", segment: "SUV", pt: "electric", engine: "Silnik synchroniczny PM", kw: 168, nm: 350, accel: 7.3, top: 185, price: 44900, drv: "RWD" },
  { make: "Hyundai", country: "Korea Płd.", model: "Tucson", segment: "SUV", pt: "hybrid", engine: "1.6L Turbo + silnik elektryczny", kw: 172, nm: 265, accel: 8.0, top: 195, price: 29650, drv: "AWD" },
  { make: "Hyundai", country: "Korea Płd.", model: "Elantra", segment: "Sedan", pt: "combustion", engine: "2.0L I4", kw: 111, nm: 179, accel: 8.5, top: 195, price: 21150, drv: "FWD" },
  { make: "Kia", country: "Korea Płd.", model: "EV6", segment: "SUV", pt: "electric", engine: "Silnik synchroniczny PM", kw: 168, nm: 350, accel: 7.4, top: 185, price: 42600, drv: "RWD" },
  { make: "Kia", country: "Korea Płd.", model: "Sportage", segment: "SUV", pt: "hybrid", engine: "1.6L Turbo + silnik elektryczny", kw: 169, nm: 265, accel: 7.9, top: 193, price: 28590, drv: "AWD" },
  { make: "Kia", country: "Korea Płd.", model: "Stinger", segment: "Sedan sportowy", pt: "combustion", engine: "3.3L Twin-Turbo V6", kw: 272, nm: 510, accel: 4.7, top: 269, price: 41290, drv: "AWD" },
  { make: "Volvo", country: "Szwecja", model: "XC90 Recharge", segment: "SUV", pt: "hybrid", engine: "2.0L T8 Twin-Engine PHEV", kw: 335, nm: 709, accel: 5.3, top: 180, price: 71900, drv: "AWD" },
  { make: "Volvo", country: "Szwecja", model: "XC60", segment: "SUV", pt: "hybrid", engine: "2.0L T6 Twin-Engine PHEV", kw: 300, nm: 620, accel: 5.5, top: 180, price: 55300, drv: "AWD" },
  { make: "Volvo", country: "Szwecja", model: "EX30", segment: "SUV", pt: "electric", engine: "Silnik synchroniczny PM", kw: 200, nm: 343, accel: 5.7, top: 180, price: 34950, drv: "RWD" },
  { make: "Fiat", country: "Włochy", model: "500e", segment: "Hatchback", pt: "electric", engine: "Silnik synchroniczny PM", kw: 87, nm: 220, accel: 9.0, top: 150, price: 32500, drv: "FWD" },
  { make: "Fiat", country: "Włochy", model: "Panda", segment: "Hatchback", pt: "combustion", engine: "1.0L Hybrid I3", kw: 51, nm: 92, accel: 14.7, top: 155, price: 16900, drv: "FWD" },
  { make: "Alfa Romeo", country: "Włochy", model: "Giulia", segment: "Sedan sportowy", pt: "combustion", engine: "2.0L Turbo I4", kw: 206, nm: 400, accel: 5.7, top: 240, price: 44590, drv: "RWD" },
  { make: "Alfa Romeo", country: "Włochy", model: "Stelvio", segment: "SUV", pt: "combustion", engine: "2.0L Turbo I4", kw: 206, nm: 400, accel: 5.7, top: 230, price: 47590, drv: "AWD" },
  { make: "Škoda", country: "Czechy", model: "Octavia", segment: "Sedan", pt: "combustion", engine: "2.0L TSI Turbo I4", kw: 140, nm: 320, accel: 8.0, top: 220, price: 26500, drv: "FWD" },
  { make: "Škoda", country: "Czechy", model: "Enyaq", segment: "SUV", pt: "electric", engine: "Silnik synchroniczny PM", kw: 150, nm: 310, accel: 8.6, top: 160, price: 34500, drv: "RWD" },
  { make: "Škoda", country: "Czechy", model: "Kodiaq", segment: "SUV", pt: "combustion", engine: "2.0L TSI Turbo I4", kw: 140, nm: 320, accel: 9.3, top: 205, price: 33900, drv: "AWD" },
  { make: "Rimac", country: "Chorwacja", model: "Nevera", segment: "Hipersamochód", pt: "electric", engine: "4x silnik synchroniczny PM", kw: 1408, nm: 2360, accel: 1.85, top: 412, price: 2400000, drv: "AWD" },
  { make: "Renault", country: "Francja", model: "Megane E-Tech", segment: "Hatchback", pt: "electric", engine: "Silnik synchroniczny PM", kw: 160, nm: 300, accel: 7.4, top: 160, price: 35000, drv: "FWD" },
  { make: "Peugeot", country: "Francja", model: "308", segment: "Hatchback", pt: "combustion", engine: "1.2L PureTech Turbo I3", kw: 96, nm: 205, accel: 10.8, top: 188, price: 23500, drv: "FWD" },
  { make: "Jaguar", country: "Wielka Brytania", model: "I-Pace", segment: "SUV", pt: "electric", engine: "Podwojny silnik PM", kw: 294, nm: 696, accel: 4.8, top: 200, price: 71575, drv: "AWD" },
  { make: "Land Rover", country: "Wielka Brytania", model: "Defender", segment: "SUV", pt: "combustion", engine: "3.0L Turbo I6", kw: 246, nm: 550, accel: 7.7, top: 191, price: 56650, drv: "AWD" },
];

const YEARS = [2022, 2023, 2024];

function buildCars() {
  const rand = mulberry32(42);
  const cars = [];
  BASE_MODELS.forEach((base, index) => {
    var jitter = function () { return 0.92 + rand() * 0.16; };
    var year = YEARS[index % YEARS.length]; // kazdy model dostaje JEDEN, przypisany rocznik
    var yearFactor = 1 + (year - 2022) * 0.02;

    cars.push({
      id: "car-" + String(index + 1).padStart(4, "0"),
      make: base.make,
      model: base.model,
      year: year,
      segment: base.segment,
      country: base.country,
      powertrain: base.pt,
      engine: base.engine,
      drivetrain: base.drv,
      powerKw: Math.round(base.kw * jitter()),
      torqueNm: Math.round(base.nm * jitter()),
      accel0to100: Math.round(base.accel * jitter() * 10) / 10,
      topSpeedKmh: Math.round(base.top * jitter()),
      priceUsd: Math.round((base.price * yearFactor * jitter()) / 10) * 10,
      description: "",
    });
  });
  return cars;
}

const ALL_CARS = buildCars();
