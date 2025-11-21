// Basic map dimensions
const width = 800;
const height = 400;

// Equirectangular projection (works fine for lunar long/lat)
const projection = d3.geoEquirectangular()
  .scale(width / (2 * Math.PI))
  .translate([width / 2, height / 2]);

const path = d3.geoPath(projection);

// One shared tooltip for both maps
const tooltip = d3.select("#tooltip");

// Helper to parse crater rows
function parseCraterRow(d) {
  let lon = +d.Longitude;

  lon = lon - 180;
  if (lon < -180) lon += 360;

  return {
    lon,
    lat: +d.Latitude,
    diameter: +d.diameter,
    created: +d.TimeStepCreated,
    survivedTime: d.SurvivedTimeStep ? +d.SurvivedTimeStep : null
  };
}

// Load all four CSVs
Promise.all([
  d3.csv("data/survived_craters_mare.csv", parseCraterRow),
  d3.csv("data/erased_craters_mare.csv", parseCraterRow)
]).then(([survMare, erasedMare]) => {

  // Compute slider range from TimeStepCreated
  const allTimes = [...survMare, ...erasedMare].map(d => d.created);
  const maxTime = d3.max(allTimes);
  const roundedMax = Math.ceil(maxTime || 100);

  setupSlider("mare", roundedMax);

  // Create Mare map
  createCraterMap({
    containerId: "#mare-map",
    survivedData: survMare,
    erasedData: erasedMare,
    prefix: "mare"
  });
/*
  createCraterMap({
    containerId: "#nonmare-map",
    survivedData: survNon,
    erasedData: erasedNon,
    prefix: "nonmare"
  }); */
}).catch(err => {
  console.error("Error loading crater data:", err);
});

// Configure a slider's max/value + label
function setupSlider(prefix, maxVal) {
  const slider = document.getElementById(`${prefix}-timestep-slider`);
  const label = document.getElementById(`${prefix}-timestep-value`);

  if (slider) {
    slider.max = maxVal;
    slider.value = 0;
  }
  if (label) {
    label.textContent = "0";
  }
}

// Main function to build each map
function createCraterMap({ containerId, survivedData, erasedData, prefix }) {
  const container = d3.select(containerId);
  const svg = container
    .append("svg")
    .attr("class", "moon-svg")
    .attr("width", width)
    .attr("height", height);

  //  
  svg.append("image")
    .attr("href", "moon_180.jpg")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", width)
    .attr("height", height)
    .attr("preserveAspectRatio", "none"); 

  // Draw a "sphere" representing the Moon
  svg.append("path")
    .datum({ type: "Sphere" })
    .attr("class", "moon-sphere")
    .attr("d", path);

    // geojson outline
  d3.json("mare_imbrium.geojson").then(region => {
    region.features[0].geometry.coordinates[0] =
    region.features[0].geometry.coordinates[0].map(([lon, lat]) => {
      lon = lon - 180;
      if (lon < -180) lon += 360;
      return [lon, lat];
    });
    
    svg.append("path")
    .datum(region)
    .attr("class", "mare-outline")
    .attr("d", path);
  });

  // gridlines
  const graticule = d3.geoGraticule();
  svg.append("path")
    .datum(graticule())
    .attr("class", "graticule")
    .attr("d", path);

  const craterGroup = svg.append("g").attr("class", "craters");

  const showSurvivedInput = document.getElementById(`${prefix}-show-survived`);
  const showErasedInput = document.getElementById(`${prefix}-show-erased`);
  const slider = document.getElementById(`${prefix}-timestep-slider`);
  const sliderLabel = document.getElementById(`${prefix}-timestep-value`);


  // Update function: filter and redraw
  function update() {
    const showSurvived = showSurvivedInput.checked;
    const showErased = showErasedInput.checked;
    const minTime = +slider.value;

    let filtered = [];

    if (showSurvived) {
      filtered.push(...survivedData.filter(d => d.created >= minTime));
    }
    if (showErased) {
      filtered.push(...erasedData.filter(d => d.created >= minTime));
    }

    const circles = craterGroup.selectAll("circle")
      .data(filtered, d => `${d.lon},${d.lat},${d.diameter}`);

    circles.exit().remove();

    circles.enter()
      .append("circle")
      .merge(circles)
      .attr("cx", d => projection([d.lon, d.lat])[0])
      .attr("cy", d => projection([d.lon, d.lat])[1])
      .attr("r", d => craterRadius(d.diameter))
      .attr("class", d =>
        survivedData.includes(d) ? "crater-survived" : "crater-erased"
      )
      .on("mouseover", (event, d) => {
        tooltip
          .style("opacity", 1)
          .html(`
            <strong>Diameter:</strong> ${d.diameter.toFixed(2)} km<br/>
            <strong>Lat:</strong> ${d.lat.toFixed(3)}°<br/>
            <strong>Lon:</strong> ${d.lon.toFixed(3)}°<br/>
            <strong>Created timestep:</strong> ${d.created}<br/>
            <strong>Survived timestep:</strong> ${d.survivedTime}
          `);
      })
      .on("mousemove", event => {
        tooltip
          .style("left", event.pageX + 12 + "px")
          .style("top", event.pageY + 12 + "px");
      })
      .on("mouseout", () => tooltip.style("opacity", 0));
  }

  // Add listeners
  showSurvivedInput.addEventListener("change", update);
  showErasedInput.addEventListener("change", update);
  slider.addEventListener("input", () => {
    sliderLabel.textContent = slider.value;
    
    update();
});

  update();

  const zoom = d3.zoom()
    .scaleExtent([1, 8]) // zoom limits
    .on("zoom", (event) => {

      craterGroup.attr("transform", event.transform);

      svg.selectAll(".mare-outline").attr("transform", event.transform);

      svg.selectAll(".graticule").attr("transform", event.transform);

      svg.selectAll("image").attr("transform", event.transform);
    });

  svg.call(zoom);
}

 // Crater radius scale
function craterRadius(diameter) {
  const minR = 1;
  const maxR = 8;
  return Math.max(minR, Math.min(maxR, Math.sqrt(diameter) * 0.8));
}