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
  return {
    lon: +d.Longitude,
    lat: +d.Latitude,
    diameter: +d.diameter,
    created: +d.TimeStepCreated,
    survivedTime: +d.SurvivedTimeStep
  };
}

// Load all four CSVs
Promise.all([
  d3.csv("data/survived_craters_mare.csv", parseCraterRow),
  d3.csv("data/erased_craters_mare.csv", parseCraterRow)
]).then(([survMare, erasedMare]) => {
  // Compute global max diameter for slider range
  const allDiameters = [
    ...survMare,
    ...erasedMare
  ].map(d => d.diameter);

  const maxDiameter = d3.max(allDiameters);
  const roundedMax = Math.ceil(maxDiameter || 50);

  // Initialize sliders with data-driven max
  setupSlider("mare", roundedMax);
  setupSlider("nonmare", roundedMax);

  // Create two separate maps
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
  const slider = document.getElementById(`${prefix}-diameter-slider`);
  const label = document.getElementById(`${prefix}-diameter-value`);

  if (slider) {
    slider.max = maxVal;
    slider.value = 0;
  }
  if (label) {
    label.textContent = "0 km";
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

  // Draw a "sphere" representing the Moon
  svg.append("path")
    .datum({ type: "Sphere" })
    .attr("class", "moon-sphere")
    .attr("d", path);

  // Optional graticule (lat/long grid)
  const graticule = d3.geoGraticule();
  svg.append("path")
    .datum(graticule())
    .attr("class", "graticule")
    .attr("d", path);

  const craterGroup = svg.append("g").attr("class", "craters");

  const showSurvivedInput = document.getElementById(`${prefix}-show-survived`);
  const showErasedInput = document.getElementById(`${prefix}-show-erased`);
  const slider = document.getElementById(`${prefix}-diameter-slider`);
  const sliderLabel = document.getElementById(`${prefix}-diameter-value`);

  // Update function: filter and redraw
  function update() {
    const showSurvived = showSurvivedInput ? showSurvivedInput.checked : true;
    const showErased = showErasedInput ? showErasedInput.checked : true;
    const minDiameter = slider ? +slider.value : 0;

    if (sliderLabel) {
      sliderLabel.textContent = `${minDiameter} km`;
    }

    // Build filtered dataset
    let filtered = [];

    if (showSurvived) {
      filtered = filtered.concat(
        survivedData.filter(d => d.diameter >= minDiameter)
      );
    }
    if (showErased) {
      filtered = filtered.concat(
        erasedData.filter(d => d.diameter >= minDiameter)
      );
    }

    // JOIN
    const circles = craterGroup.selectAll("circle").data(filtered, d => d.id || `${d.lon},${d.lat},${d.diameter}`);

    // EXIT
    circles.exit().remove();

    // ENTER + UPDATE
    circles
      .enter()
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
          .html(
            `<strong>Diameter:</strong> ${d.diameter.toFixed(2)} km<br/>
             <strong>Created timestep:</strong> ${d.created}<br/>
             <strong>Survived timestep:</strong> ${d.survivedTime}`
          );
      })
      .on("mousemove", event => {
        tooltip
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + 10 + "px");
      })
      .on("mouseout", () => {
        tooltip.style("opacity", 0);
      });
  }

  // Attach UI listeners
  if (showSurvivedInput) {
    showSurvivedInput.addEventListener("change", update);
  }
  if (showErasedInput) {
    showErasedInput.addEventListener("change", update);
  }
  if (slider) {
    slider.addEventListener("input", update);
  }

  // Initial draw
  update();
}

// Simple radius scale (tweak as needed)
function craterRadius(diameter) {
  // Avoid huge circles; square-root scale feels better
  const minR = 1;
  const maxR = 8;
  // You can tune 100 here based on your actual max
  return Math.max(minR, Math.min(maxR, Math.sqrt(diameter) * 0.8));
}
