"""Mock data sources simulating real-time ingestion from:
  - IMD official
  - Twitter / X
  - Facebook
  - News outlets (Reuters, TOI, HT)
  - Citizen reports

Generates realistic India-focused weather events with GPS, cities, hashtags.
"""
from __future__ import annotations

import random
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List


# ---------- Indian cities with coordinates ----------

@dataclass
class City:
    name: str
    state: str
    lat: float
    lon: float


CITIES: List[City] = [
    City("Mumbai", "Maharashtra", 19.0760, 72.8777),
    City("Delhi", "Delhi", 28.6139, 77.2090),
    City("Bangalore", "Karnataka", 12.9716, 77.5946),
    City("Hyderabad", "Telangana", 17.3850, 78.4867),
    City("Chennai", "Tamil Nadu", 13.0827, 80.2707),
    City("Kolkata", "West Bengal", 22.5726, 88.3639),
    City("Pune", "Maharashtra", 18.5204, 73.8567),
    City("Ahmedabad", "Gujarat", 23.0225, 72.5714),
    City("Jaipur", "Rajasthan", 26.9124, 75.7873),
    City("Lucknow", "Uttar Pradesh", 26.8467, 80.9462),
    City("Kanpur", "Uttar Pradesh", 26.4499, 80.3319),
    City("Nagpur", "Maharashtra", 21.1458, 79.0882),
    City("Indore", "Madhya Pradesh", 22.7196, 75.8577),
    City("Thane", "Maharashtra", 19.2183, 72.9781),
    City("Bhopal", "Madhya Pradesh", 23.2599, 77.4126),
    City("Visakhapatnam", "Andhra Pradesh", 17.6868, 83.2185),
    City("Patna", "Bihar", 25.5941, 85.1376),
    City("Vadodara", "Gujarat", 22.3072, 73.1812),
    City("Ghaziabad", "Uttar Pradesh", 28.6692, 77.4538),
    City("Ludhiana", "Punjab", 30.9010, 75.8573),
    City("Agra", "Uttar Pradesh", 27.1767, 78.0081),
    City("Nashik", "Maharashtra", 19.9975, 73.7898),
    City("Faridabad", "Haryana", 28.4089, 77.3178),
    City("Meerut", "Uttar Pradesh", 28.9845, 77.7064),
    City("Rajkot", "Gujarat", 22.3039, 70.8022),
    City("Varanasi", "Uttar Pradesh", 25.3176, 82.9739),
    City("Srinagar", "Jammu & Kashmir", 34.0837, 74.7973),
    City("Amritsar", "Punjab", 31.6340, 74.8723),
    City("Chandigarh", "Chandigarh", 30.7333, 76.7794),
    City("Guwahati", "Assam", 26.1445, 91.7362),
    City("Bhubaneswar", "Odisha", 20.2961, 85.8245),
    City("Thiruvananthapuram", "Kerala", 8.5241, 76.9366),
    City("Kochi", "Kerala", 9.9312, 76.2673),
    City("Coimbatore", "Tamil Nadu", 11.0168, 76.9558),
    City("Mangalore", "Karnataka", 12.9141, 74.8560),
    City("Shimla", "Himachal Pradesh", 31.1048, 77.1734),
    City("Manali", "Himachal Pradesh", 32.2396, 77.1887),
    City("Leh", "Ladakh", 34.1526, 77.5770),
    City("Panaji", "Goa", 15.4989, 73.8278),
    City("Ranchi", "Jharkhand", 23.3441, 85.3096),
    City("Raipur", "Chhattisgarh", 21.2514, 81.6296),
    City("Dehradun", "Uttarakhand", 30.3165, 78.0322),
    City("Haridwar", "Uttarakhand", 29.9457, 78.1642),
]


# ---------- Source-specific templates ----------

IMD_TEMPLATES = [
    "IMD update: Heavy to very heavy rainfall expected over {city} district in next 24 hours. #IMD #WeatherAlert",
    "IMD bulletin: Temperature in {city} likely to touch 45°C today. Heatwave warning issued. #IMD",
    "IMD: Cyclonic circulation observed off the coast near {city}. Fishermen advised not to venture into sea. #IMD",
    "IMD forecast: Dense fog likely over {city} and adjoining areas. Visibility may drop below 200m. #IMD",
    "IMD: Thunderstorm with lightning and gusty winds (40-50 kmph) very likely over {city}. #IMD",
    "IMD warning: Extremely heavy rainfall (>204.5mm) very likely at isolated places over {city}. #IMD #Monsoon",
    "IMD: Heatwave conditions very likely to prevail over {city}. Maximum temp may be 5-7°C above normal. #IMD",
]

NEWS_TEMPLATES = [
    "According to IMD, {city} recorded 120mm of rainfall in the last 24 hours. #WeatherUpdate",
    "Reports from {city}: Severe waterlogging in low-lying areas after heavy rain since last night. #Flooding",
    "{city} airport operations affected as fog reduces visibility to near zero. #Fog #Weather",
    "Power outages reported across several localities in {city} following strong winds and rain. #Storm",
    "Schools in {city} to remain closed tomorrow due to severe heatwave conditions. #Heatwave",
    "Hailstorm damages crops in parts of {city} district. Farmers seek compensation. #WeatherDamage",
    "NDMA issues alert for {city} as river water level rises above danger mark. #Flooding #NDMA",
]

TWITTER_TEMPLATES_REAL = [
    "Heavy rain lashing {city} right now. Streets are waterlogged. Stay safe everyone! #WeatherAlert #IMD",
    "Thunderstorm in {city} since morning. Power went out in our area. #Storm #IMD",
    "It's so hot in {city} today, 43°C according to my car thermometer. Stay hydrated. #Heatwave",
    "Beautiful snowfall in {city}! First snow of the season. ❄️ #Snowfall",
    "Dense fog in {city}, can barely see 50 meters. Drive safe. #Fog #IMD",
    "Dust storm approaching {city}, sky turned orange. #DustStorm",
    "Winds are insane in {city} today, my umbrella just flipped inside out. #WindAlert",
]

TWITTER_TEMPLATES_FAKE = [
    "SHOCKING!!! 100 feet tsunami about to hit {city}!!! Run for your lives!!! #Breaking #IMD",
    "You won't believe what IMD is hiding from {city} residents!!! #Conspiracy #Exposed",
    "URGENT: {city} will be DESTROYED by mega cyclone in next 24 hours!!! Share now!!! #Viral",
    "Fake news! IMD lying about {city} weather! Wake up people! #Truth",
    "BREAKING!!! Cloudburst warning for {city}!!! Officials covering up the truth!!! #IMD",
]

CITIZEN_TEMPLATES = [
    "Reporting from {city}: Heavy rain started 30 mins ago, no warning issued. Roads flooded.",
    "{city}: Power cut for last 4 hours due to strong winds. Trees down in our colony.",
    "Live from {city} market area: Water entered shops after sudden downpour. #CitizenReport",
    "{city} witnessed hailstorm for first time in 10 years. Crops damaged.",
    "Felt mild tremors and thunder in {city} just now. Any official confirmation?",
]


@dataclass
class RawEvent:
    external_id: str
    source: str
    text: str
    language: str = "en"
    city: str = ""
    state: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    has_image: bool = False
    image_url: str | None = None
    has_video: bool = False
    event_time: datetime = field(default_factory=datetime.utcnow)


# ---------- Generator ----------

class MockDataGenerator:
    """Generate realistic mock weather events for the prototype demo."""

    SOURCES = {
        "imd_official": {"weight": 0.12, "templates": IMD_TEMPLATES, "type": "official"},
        "news_reuters": {"weight": 0.10, "templates": NEWS_TEMPLATES, "type": "news"},
        "news_toi": {"weight": 0.10, "templates": NEWS_TEMPLATES, "type": "news"},
        "news_hindustan": {"weight": 0.10, "templates": NEWS_TEMPLATES, "type": "news"},
        "twitter_verified": {"weight": 0.18, "templates": TWITTER_TEMPLATES_REAL, "type": "social"},
        "twitter_citizen": {"weight": 0.20, "templates": TWITTER_TEMPLATES_REAL + TWITTER_TEMPLATES_FAKE, "type": "social"},
        "citizen_report": {"weight": 0.20, "templates": CITIZEN_TEMPLATES, "type": "citizen"},
    }

    def __init__(self, seed: int | None = None):
        self.rng = random.Random(seed)
        self._sources = list(self.SOURCES.keys())
        self._weights = [self.SOURCES[s]["weight"] for s in self._sources]

    def _pick_source(self) -> str:
        return self.rng.choices(self._sources, weights=self._weights, k=1)[0]

    def _pick_city(self) -> City:
        return self.rng.choice(CITIES)

    def _jitter_coords(self, city: City) -> tuple[float, float]:
        # Add ~5km jitter
        lat = city.lat + self.rng.uniform(-0.05, 0.05)
        lon = city.lon + self.rng.uniform(-0.05, 0.05)
        return round(lat, 6), round(lon, 6)

    def _format(self, template: str, city: City) -> str:
        return template.format(city=city.name)

    def generate(self, source_override: str | None = None) -> RawEvent:
        source = source_override or self._pick_source()
        meta = self.SOURCES[source]
        template = self.rng.choice(meta["templates"])
        city = self._pick_city()
        lat, lon = self._jitter_coords(city)

        text = self._format(template, city)
        has_image = self.rng.random() < 0.35
        has_video = self.rng.random() < 0.05 and source.startswith("twitter")

        # Time within last 6 hours
        event_time = datetime.utcnow() - timedelta(minutes=self.rng.randint(0, 360))

        return RawEvent(
            external_id=str(uuid.uuid4()),
            source=source,
            text=text,
            city=city.name,
            state=city.state,
            latitude=lat,
            longitude=lon,
            has_image=has_image,
            image_url=f"https://cdn.weather.gov.in/{self.rng.randint(10000, 99999)}.jpg" if has_image else None,
            has_video=has_video,
            event_time=event_time,
        )

    def generate_batch(self, n: int) -> List[RawEvent]:
        return [self.generate() for _ in range(n)]


def generate_batch(n: int = 10, seed: int | None = None) -> List[RawEvent]:
    return MockDataGenerator(seed=seed).generate_batch(n)
