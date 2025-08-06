figma.showUI(__html__, { themeColors: true });

figma.ui.resize(240, 484);

function findMin(a: number, b: number) {
  if (a < b) {
    return a;
  } else {
    return b;
  }
}

function removeStroke(obj: any) {
  let newObject = JSON.parse(JSON.stringify(obj.strokes));
  newObject.length = 0;
  obj.strokes = newObject;
}

function removeFill(obj: any) {
  let newObject = JSON.parse(JSON.stringify(obj.fills));
  newObject.length = 0;
  obj.fills = newObject;
}

function rearrangeArray(arr: any[]) {
  let n = arr.length;
  let newarr = [];
  let appendarr = [];
  let append = 2 + 2 * Math.floor((n - 6) / 4);
  newarr[0] = arr[0];
  newarr[1] = arr[1];
  if (n > 2) {
    let j = 2;
    for (let i = 4; i < n; i += 4) {
      newarr[i] = arr[j];
      newarr[i + 1] = arr[j + 1];
      j += 2;
    }
    appendarr = arr.slice(-append);
    let gapIndex = 0;
    for (let i = 0; i < appendarr.length; i++) {
      // Find the first gap in the targetArray
      while (gapIndex < newarr.length && newarr[gapIndex] !== undefined) {
        gapIndex++;
      }

      // If gapIndex exceeds the newarr length, break out of the loop
      if (gapIndex >= newarr.length) {
        break;
      }

      // Place the item from the appendarr into the gap
      newarr[gapIndex] = appendarr[i];

      // Increment gapIndex to find the next gap
      gapIndex++;
    }
  }

  return newarr;
}

async function processVectorVertices(vectorNode: VectorNode, yOffset: number) {
  const { vertices } = vectorNode.vectorNetwork;

  // Step 1: Remove vertices with y > 0 and sort by x ascending
  const sortedVertices = vertices
    .filter((vertex) => vertex.y <= 0)
    .sort((a, b) => a.x - b.x);

  const updatedVertices: VectorVertex[] = [];

  // Step 2: Copy vertices and insert duplicates (y - 1) between (1,2), (3,4), etc.
  for (let i = 0; i < sortedVertices.length; i++) {
    updatedVertices.push(sortedVertices[i]);

    // After every odd index (1, 3, 5...), insert shifted duplicates of (i, i+1)
    if (i % 2 === 1 && i + 1 < sortedVertices.length) {
      updatedVertices.push(
        { ...sortedVertices[i], y: sortedVertices[i].y - yOffset },
        { ...sortedVertices[i + 1], y: sortedVertices[i + 1].y - yOffset }
      );
    }
  }

  // Step 3: Create sequential segments to connect all updated vertices
  const updatedSegments: VectorSegment[] = [];
  for (let i = 0; i < updatedVertices.length - 1; i++) {
    updatedSegments.push({
      start: i,
      end: i + 1,
    });
  }

  // Step 4: Apply new vector network
  await vectorNode.setVectorNetworkAsync({
    vertices: updatedVertices,
    segments: updatedSegments,
    regions: [],
  });
}

figma.ui.onmessage = async (msg) => {
  // Check 'Create lines' button trigger
  if (msg.type === "create-emboss") {
    let selected = figma.currentPage.selection;
    let selectedNumber = selected.length;

    if (selectedNumber === 0) {
      // Check if at least one layer is selected
      figma.notify("Select at least one vector layer.");
    } else if (selectedNumber > 20) {
      // Throw an error when more than 20 layers selected
      figma.notify("Maximum of 20 layers can be selected.");
    } else {
      // Check if all selected are vector layers
      const allVectors = selected.every(
        (item) =>
          item.type === "VECTOR" ||
          item.type === "ELLIPSE" ||
          item.type === "POLYGON" ||
          item.type === "RECTANGLE" ||
          item.type === "STAR"
      );
      if (allVectors) {
        // Start loop for every vector layer selected
        let selection: SceneNode[] = [];

        for (const shape of selected) {
          let nodes: SceneNode[] = [];

          if (
            shape.type === "VECTOR" ||
            shape.type === "ELLIPSE" ||
            shape.type === "POLYGON" ||
            shape.type === "RECTANGLE" ||
            shape.type === "STAR"
          ) {
            // Interface variables
            const {
              lineOffset,
              peakRatio,
              baseCorner,
              peakCorner,
              baseFade,
              lineNumber,
              strokeTop,
              strokeBottom,
              strokeColor,
              contrast,
              patternWidth,
            } = msg;

            // Start loop for each line
            for (let i = 0; i < lineNumber; i++) {
              // Draw line
              const line = figma.createVector();
              // Duplicate shape
              let shapeclone = shape.clone();
              shapeclone = figma.flatten([shapeclone]);

              // Position shape
              shapeclone.y = shapeclone.y + shapeclone.height + 80;

              // Remove shape stroke and fill
              removeStroke(shapeclone);
              removeFill(shapeclone);

              // Resize and move line
              await line.setVectorNetworkAsync({
                vertices: [
                  { x: 0, y: 0 },
                  { x: shapeclone.width * patternWidth, y: 0 },
                ],
                segments: [{ start: 0, end: 1 }],
              });

              // Get line gap and peak height
              const lineGap =
                (shapeclone.height - 2 * lineOffset) / (lineNumber - 1);
              const peakHeight = peakRatio * lineGap;

              // Position line
              line.y = shapeclone.y + 0.5 + lineOffset + i * lineGap;
              line.x = shapeclone.x - line.width / 2 + shapeclone.width / 2;

              // Subtract shape from line
              const linebase = figma.subtract(
                [shapeclone, line],
                figma.currentPage
              );

              // Flatten subtracted line
              const linebaseflat = figma.flatten([linebase]);

              // Remove fill from subtracted line
              removeFill(linebaseflat);

              // Delete bottom row vertices
              await processVectorVertices(linebaseflat, peakHeight);
              let lineclean: VectorNode;
              lineclean = linebaseflat;

              // Rename line
              lineclean.name = `Line ${i + 1}`;

              // Storing some commonly used parameters
              const verticesLength = lineclean.vectorNetwork.vertices.length;
              const color = figma.util.rgb(strokeColor);
              const contrastGap = 0.05 * (1 - contrast);
              let colorArr: {
                color: { a: number; r: number; g: number; b: number };
                position: number;
              }[] = [];
              let colorObject = {
                type: "GRADIENT_LINEAR",
                visible: true,
                opacity: 1,
                blendMode: "NORMAL",
                gradientStops: colorArr,
                gradientTransform: [
                  [1, 0, 0],
                  [0, 1, 0],
                ],
              };

              // Add stroke
              const strokeTemp = JSON.parse(JSON.stringify(lineclean.strokes));

              for (let n = 0; n < verticesLength; n++) {
                const xposition =
                  lineclean.vectorNetwork.vertices[n].x /
                  lineclean.vectorNetwork.vertices[verticesLength - 1].x;
                let newObj = {
                  color: { ...color, a: 0 },

                  position: xposition,
                };
                colorArr.push(newObj);
              }
              strokeTemp[0] = colorObject;
              lineclean.strokes = strokeTemp;

              // Update stroke widths
              lineclean.strokeWeight =
                strokeTop + ((strokeBottom - strokeTop) * i) / (lineNumber - 1);

              // Add corner radii to the vertices
              const cornerTemp = JSON.parse(
                JSON.stringify(lineclean.vectorNetwork)
              );

              // Base corner radii
              for (var a = 1; a < verticesLength - 1; a += 4) {
                cornerTemp.vertices[a].cornerRadius = baseCorner;
                strokeTemp[0].gradientStops[a].color.a = 0.5;
              }
              for (var b = 4; b < verticesLength - 1; b += 4) {
                cornerTemp.vertices[b].cornerRadius = baseCorner;
                strokeTemp[0].gradientStops[b].color.a = 0.5;
              }

              // Peak corner radii
              for (var c = 2; c < verticesLength - 1; c += 4) {
                cornerTemp.vertices[c].cornerRadius = peakCorner;
                strokeTemp[0].gradientStops[c].color.a = 1;
                let x =
                  strokeTemp[0].gradientStops[c - 1].position -
                  strokeTemp[0].gradientStops[c - 2].position;
                strokeTemp[0].gradientStops[c - 1].position =
                  strokeTemp[0].gradientStops[c].position -
                  findMin(contrastGap, x) / 2;
              }
              for (var d = 3; d < verticesLength - 1; d += 4) {
                cornerTemp.vertices[d].cornerRadius = peakCorner;
                strokeTemp[0].gradientStops[d].color.a = 1;
                let x =
                  strokeTemp[0].gradientStops[d + 2].position -
                  strokeTemp[0].gradientStops[d + 1].position;
                strokeTemp[0].gradientStops[d + 1].position =
                  strokeTemp[0].gradientStops[d].position +
                  findMin(contrastGap, x) / 2;
              }

              await lineclean.setVectorNetworkAsync(cornerTemp);

              // Outset base points and increase corner radius
              const fadeTemp = JSON.parse(
                JSON.stringify(lineclean.vectorNetwork)
              );

              if (verticesLength < 6) {
                // console.log("single line");

                // Add a 0.5 opacity gradientstop for lines without elevation
                const middleStop = {
                  color: { ...color, a: 0.5 },
                  position: 0.5,
                };
                strokeTemp[0].gradientStops.splice(1, 0, middleStop);
              } else {
                fadeTemp.vertices[1].x -= baseFade;
                fadeTemp.vertices[verticesLength - 2].x += baseFade;
              }

              for (var j = 5; j < verticesLength - 2; j += 4) {
                const margin =
                  fadeTemp.vertices[j].x - fadeTemp.vertices[j - 1].x;
                fadeTemp.vertices[j].cornerRadius = baseCorner * 10;
                fadeTemp.vertices[j - 1].cornerRadius = baseCorner * 10;
                fadeTemp.vertices[j].x -= margin / 3;
                fadeTemp.vertices[j - 1].x += margin / 3;
                fadeTemp.vertices[j].y -= peakHeight / 2;
                fadeTemp.vertices[j - 1].y -= peakHeight / 2;
              }

              await lineclean.setVectorNetworkAsync(fadeTemp);
              lineclean.strokes = strokeTemp;

              nodes.push(lineclean);

              //code block ends here
            }

            let group = figma.group(nodes, figma.currentPage);
            group.expanded = false;

            selection.push(group);
          }
        }
        // figma.currentPage.selection = selection;
        figma.viewport.scrollAndZoomIntoView(selection);
      } else figma.notify("🚫 Works only with flattened vector layers");
    }
  }
  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  // figma.closePlugin();
};
