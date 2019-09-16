import * as fs from "fs";
import { isObject, isString, isNumber } from "util";

export interface Star {
  x: number;
  y: number;
  z: number;
  name: string;
  object_id: number;
  type: string;
}

export interface Planet {
  x: number;
  y: number;
  z: number;
  name: string;
  index: string;
  _index: number;
}

export interface GuideEntry {
  object_id: number;
  text: string;
}

const DEFAULT_PRECISION = 0.00001;

function isStar(star: any): star is Star {
  return (
    star.hasOwnProperty("x") &&
    star.hasOwnProperty("y") &&
    star.hasOwnProperty("z") &&
    star.hasOwnProperty("object_id")
  );
}

export class Noctis {
  public guide_data: GuideEntry[] = [];
  public stars: Star[] = [];
  public planets: Planet[] = [];

  constructor(starmapPath: string, guidePath: string) {
    this.readStarmap(starmapPath);
    this.readGuide(guidePath);
  }

  readStarmap(starmapPath) {
    const buffer = fs.readFileSync(starmapPath);

    let dataView = new DataView(buffer.buffer);
    let offset = 0;
    const readUInt8 = function() {
      const retval = buffer.readUInt8(offset);
      offset += 1;
      return retval;
    };
    const readInt32 = function() {
      const retval = buffer.readInt32LE(offset);
      offset += 4;
      return retval;
    };

    const numEntries = dataView.byteLength / 44;
    const stars: Star[] = [];
    const planets: Planet[] = [];

    for (let i = 0; i < numEntries; i++) {
      const star_x = readInt32();
      const star_y = readInt32();
      const star_z = readInt32();
      const index = readInt32();
      const unused = readInt32();
      const name = [
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8(),
        readUInt8()
      ]
        .map(x => String.fromCodePoint(x))
        .join("")
        .trim();
      const typestr = [readUInt8(), readUInt8(), readUInt8(), readUInt8()]
        .map(x => String.fromCodePoint(x))
        .join("");

      if (typestr[1] === "S") {
        stars.push({
          x: star_x,
          y: star_y,
          z: star_z,
          name: name,
          object_id: this.getIDForStarCoordinates(star_x, star_y, star_z),
          type: typestr.substr(2)
        });
      } else if (typestr[1] === "P") {
        planets.push({
          x: star_x,
          y: star_y,
          z: star_z,
          name: name,
          index: typestr.substr(2),
          _index: index
        });
      }
    }
    this.stars = stars;
    this.planets = planets;
  }

  readGuide(guidePath) {
    const buffer_guide = fs.readFileSync(guidePath);
    let offset = 4;
    const getUInt8 = function() {
      const retval = buffer_guide.readUInt8(offset);
      offset += 1;
      return retval;
    };
    const getDoubleLE = function() {
      const retval = buffer_guide.readDoubleLE(offset);
      offset += 8;
      return retval;
    };
    let datas: GuideEntry[] = [];
    while (offset < buffer_guide.byteLength) {
      let objid = getDoubleLE();
      let text = "";
      for (let j = 0; j < 76; j++) {
        text = text + String.fromCharCode(getUInt8());
      }
      let newdata = {
        object_id: objid,
        text: text.replace(/[^ -~]+/g, "")
      };
      datas.push(newdata);
    }
    this.guide_data = datas;
  }

  getIDForStarCoordinates = (x, y, z) => {
    return (x / 100000) * (y / 100000) * (z / 100000);
  };

  getStarByName = (starname: string) => {
    const starname_lower = starname.toLowerCase();
    return this.stars.find(star => {
      return star.name.toLowerCase() == starname_lower;
    });
  };

  getPlanetByName = (planetname: string) => {
    const planetname_lower = planetname.toLowerCase();
    return this.planets.find(planet => {
      return planet.name.toLowerCase() == planetname_lower;
    });
  };

  getIDForStar = (starname_or_object: string | Star) => {
    let star: Star | undefined = undefined;
    if (isString(starname_or_object)) {
      star = this.getStarByName(starname_or_object);
    } else {
      star = starname_or_object;
    }
    if (isStar(star)) {
      return this.getIDForStarCoordinates(star.x, star.y, star.z);
    }
  };

  getStarByID = (starid: number, precision?: number) => {
    if (!isNumber(starid)) {
      let starid_ = this.getIDForStar(starid);
      if (starid_ !== undefined) {
        starid = starid_;
      }
    }
    return this.stars.find(function(entry) {
      const diff = entry.object_id - starid;
      return (
        diff > (precision === undefined ? -DEFAULT_PRECISION : -precision) &&
        diff < (precision === undefined ? DEFAULT_PRECISION : precision)
      );
    });
  };

  getGuideEntriesById = (id: number, precision?: number) => {
    if (precision === undefined) {
      precision = DEFAULT_PRECISION;
    }
    return this.guide_data.filter(function(entry) {
      const diff = entry.object_id - id;
      return (
        diff > (precision === undefined ? -DEFAULT_PRECISION : -precision) &&
        diff < (precision === undefined ? DEFAULT_PRECISION : precision)
      );
    });
  };

  getGuideEntriesForStar = starid => {
    if (!isNumber(starid)) {
      starid = this.getIDForStar(starid);
    }
    return this.getGuideEntriesById(starid);
  };

  getPlanetsForStar = (starid: number | string) => {
    let starID: number | undefined;
    if (!isNumber(starid)) {
      const id = this.getIDForStar(starid);
      if (id !== undefined) {
        starID = id;
      }
    }
    if (isNumber(starID)) {
      const star = this.getStarByID(starID);
      if (star) {
        return this.planets.reduce(
          (memo, planet) => {
            if (
              planet.x === star.x &&
              planet.y === star.y &&
              planet.z === star.z
            ) {
              memo.push(planet);
            }
            return memo;
          },
          [] as Planet[]
        );
      }
    }
    return [];
  };

  getGuideEntriesForPlanet = (objid: number | string) => {
    if (!isNumber(objid)) {
      const planet = this.getPlanetByName(objid);
      if (planet) {
        const starid = this.getIDForStarCoordinates(
          planet.x,
          planet.y,
          planet.z
        );
        const planetid = planet._index + starid;
        return this.getGuideEntriesById(planetid);
      } else {
        return [];
      }
    } else {
      return this.getGuideEntriesById(objid);
    }
  };

  getGuideEntriesForPlanetByName = (planetName: string) => {
    return this.getGuideEntriesForPlanet(planetName);
  };
}
