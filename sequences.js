// Dimensions of sunburst.
var width = 700;
var height = 700;
var radius = Math.min(width, height) / 2;

// Breadcrumb dimensions: width, height, spacing, width of tip/tail.
var b = {
    w: 75,
    h: 30,
    s: 3,
    t: 10
};

// Mapping of step names to colors.
var colors = {
    "Military": "#da3e18",
    "School": "#ed7833",
    "Work": "#e1b256",
    "Retired": "#6e8f58",
    "TBD": "#267f85"
};


// Total size of all segments; we set this later, after loading the data.
var totalSize = 0;

// Have overall results show automatically on startup
var overall = d3.json("/data/overall/overall.json", function(error, data) {
    overall = data;
    createVisualization(overall);
});

drawLegend();



// Main function to draw and set up the visualization, once we have the data.
function createVisualization(json) {

    d3.select("#title")
        .text(json.category);

    d3.select("#subtitle")
        .text(json.subtitle);

    // Used later to calculate sums
    function leafLeft(node) {
        var children;
        while (children = node.children) node = children[0];
        return node;
    }

    function leafRight(node) {
        var children;
        while (children = node.children) node = children[children.length - 1];
        return node;
    }

    // Basic setup of page elements.
    initializeBreadcrumbTrail();
    d3.select("#chart svg").remove();

    var vis = d3.select("#chart").append("svg:svg")
        .attr("width", width)
        .attr("height", height)
        .append("svg:g")
        .attr("id", "container")
        .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");


    var partition = d3.partition()
        .size([2 * Math.PI, radius * radius]);

    var arc = d3.arc()
        .startAngle(function(d) { return d.x0; })
        .endAngle(function(d) { return d.x1; })
        .innerRadius(function(d) { return Math.sqrt(d.y0); })
        .outerRadius(function(d) { return Math.sqrt(d.y1); });



    // Bounding circle underneath the sunburst, to make it easier to detect
    // when the mouse leaves the parent g.
    vis.append("svg:circle")
        .attr("r", radius)
        .style("opacity", 0);

    console.log(json);

    // Turn the data into a d3 hierarchy and calculate the sums.
    var root = d3.hierarchy(json)
        .sort(function(a, b) { return b.value - a.value; });

    console.log(root);

    // Calculate sums without adding every size value (i.e. keep the total
    // at number of participants)
    var left = leafLeft(root)
    var right = leafRight(root)

    root.each(function(d) {
        d.value = d.data.size;
    });

    root.value = root.children.reduce(
        function(left, right) {
            return left + right.value
        },
        0
    );

    // For efficiency, filter nodes to keep only those large enough to see.
    var nodes = partition(root).descendants()
        .filter(function(d) {
            return (d.x1 - d.x0 > 0.003); // 0.005 radians = 0.29 degrees
        });

    var path = vis.data([json]).selectAll("path")
        .data(nodes)
        .enter().append("svg:path")
        .attr("display", function(d) { return d.depth ? null : "none"; })
        .attr("d", arc)
        .attr("fill-rule", "evenodd")
        .style("fill", function(d) { return colors[d.data.name]; })
        .style("stroke", "1e1f21")
        .style("opacity", 1)
        .on("mouseover", mouseover);

    // Add the mouseleave handler to the bounding circle.
    d3.select("#container").on("mouseleave", mouseleave);

    // Get total size of the tree = value of root node from partition.
    totalSize = path.datum().value;

    // Fade all but the current sequence, and show it in the breadcrumb trail.
    function mouseover(d) {

        var percentage = (100 * d.value / totalSize).toPrecision(3);
        var percentageString = percentage + "%";
        if (percentage < 0.1) {
            percentageString = "< 0.1%";
        }

        var explanation = "of all participants chose this exact path after high school";
        if (d.data.name === "TBD") {
            explanation = "of participants have not reached this stage in their cycle yet";
        };

        var rawcount = `(${d.value} of ${totalSize})`;

        d3.select("#percentage")
            .text(percentageString);

        d3.select("#rawcount")
            .text(rawcount);

        d3.select("#description")
            .text(explanation);

        d3.select("#explanation")
            .style("visibility", "");


        var sequenceArray = d.ancestors().reverse();
        sequenceArray.shift(); // remove root node from the array
        updateBreadcrumbs(sequenceArray, percentageString);

        // Fade all the segments.
        d3.selectAll("path")
            .style("opacity", 0.3);

        // Then highlight only those that are an ancestor of the current segment.
        vis.selectAll("path")
            .filter(function(node) {
                return (sequenceArray.indexOf(node) >= 0);
            })
            .style("opacity", 1);

        vis.selectAll("#path").exit().remove();
        d3.selectAll("#path").exit().remove();
    }
    // Restore everything to full opacity when moving off the visualization.
    function mouseleave(d) {

        // Hide the breadcrumb trail
        d3.select("#trail")
            .style("visibility", "hidden");

        // Deactivate all segments during transition.
        d3.selectAll("path").on("mouseover", null);

        // Transition each segment to full opacity and then reactivate it.
        d3.selectAll("path")
            .transition()
            .duration(1000)
            .style("opacity", 1)
            .on("end", function() {
                d3.select(this).on("mouseover", mouseover);
            });

        d3.select("#explanation")
            .style("visibility", "hidden");

        d3.selectAll("#path").exit().remove();
        d3.selectAll("#explanation").exit().remove();
    }
};



function initializeBreadcrumbTrail() {
    // Add the svg area.
    var trail = d3.select("#sequence").append("svg:svg")
        .attr("width", width)
        .attr("height", 50)
        .attr("id", "trail");
    // Add the label at the end, for the percentage.
    trail.append("svg:text")
        .attr("id", "endlabel")
        .style("fill", "#000");

    trail.exit().remove();
}

// Generate a string that describes the points of a breadcrumb polygon.
function breadcrumbPoints(d, i) {
    var points = [];
    points.push("0,0");
    points.push(b.w + ",0");
    points.push(b.w + b.t + "," + (b.h / 2));
    points.push(b.w + "," + b.h);
    points.push("0," + b.h);
    if (i > 0) { // Leftmost breadcrumb; don't include 6th vertex.
        points.push(b.t + "," + (b.h / 2));
    }
    return points.join(" ");
}

// Update the breadcrumb trail to show the current sequence and percentage.
function updateBreadcrumbs(nodeArray, percentageString) {

    // Data join; key function combines name and depth (= position in sequence).
    var trail = d3.select("#trail")
        .selectAll("g")
        .data(nodeArray, function(d) { return d.data.name + d.depth; });

    // Remove exiting nodes.
    trail.exit().remove();

    // Add breadcrumb and label for entering nodes.
    var entering = trail.enter().append("svg:g");

    entering.append("svg:polygon")
        .attr("points", breadcrumbPoints)
        .style("fill", function(d) { return colors[d.data.name]; });

    entering.append("svg:text")
        .attr("x", (b.w + b.t) / 2)
        .attr("y", b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return d.data.name; });

    // Merge enter and update selections; set position for all nodes.
    entering.merge(trail).attr("transform", function(d, i) {
        return "translate(" + i * (b.w + b.s) + ", 0)";
    });

    // Now move and update the percentage at the end.
    d3.select("#trail").select("#endlabel")
        .attr("x", (nodeArray.length + 0.5) * (b.w + b.s))
        .attr("y", b.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(percentageString);

    // Make the breadcrumb trail visible, if it's hidden.
    d3.select("#trail")
        .style("visibility", "");

    trail.exit().remove();
}


function drawLegend() {

    // Dimensions of legend item: width, height, spacing, radius of rounded rect.
    var li = {
        w: 75,
        h: 30,
        s: 3,
        r: 3
    };

    var legend = d3.select("#legend").append("svg:svg")
        .attr("width", li.w)
        .attr("height", d3.keys(colors).length * (li.h + li.s));

    // Define the div for the tooltip
    var div = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    var g = legend.selectAll("g")
        .data(d3.entries(colors))
        .enter().append("svg:g")
        .attr("transform", function(d, i) {
            return "translate(0," + i * (li.h + li.s) + ")";
        });

    g.append("svg:rect")
        .attr("rx", li.r)
        .attr("ry", li.r)
        .attr("width", li.w)
        .attr("height", li.h)
        .style("fill", function(d) { return d.value; })
        .on("mouseover", function(d) {
            div.transition()
                .duration(200)
                .style("opacity", .9);
            // Different tooltips based on what legend option the mouse hovers over
            switch (d.key) {
                case "Military":
                    div.html("This path indicates that the participant enlisted in the military as active duty. This may also indicate that they both joined the military and enrolled in school (ROTC program, Military Academy, etc.).")
                        .style("left", "1020px")
                        .style("top", "94px")
                    break;
                case "School":
                    div.html("This path indicates that the participant enrolled in school full-time (college, university, trade school, etc.). This may also indicate that they both enrolled in school and joined the Reserves or National Guard, transferred schools, or went to another school after graduating.")
                        .style("left", "1020px")
                        .style("top", "127px");
                    break;
                case "Work":
                    div.html("This path indicates that the participant started working a full-time, non-military job. This may also indicate that they both started working a full-time job and joined the Reserves or National Guard, or it may indicate that they both worked a full-time job and enrolled in school part-time (college, university, trade school, etc.).")
                        .style("left", "1020px")
                        .style("top", "160px");
                    break;
                case "Retired":
                    div.html("This path indicates that the participant has retired and is no longer working, going to school, or in the military.")
                        .style("left", "1020px")
                        .style("top", "193px");
                    break;
                case "TBD":
                    div.html("This path indicates that the participant has not reached the next stage in their life cycle yet. This may also indicate that the participant did not wish to share the further stages of their cycle.")
                        .style("left", "1020px")
                        .style("top", "226px");
                    break;
            }
        })
        .on("mouseout", function(d) {
            div.transition()
                .duration(500)
                .style("opacity", 0);
        });

    g.append("svg:text")
        .attr("x", li.w / 2)
        .attr("y", li.h / 2)
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return d.key; })
        // Without a repeat of this code, the tooltip would not appear when the
        // mouse hovers over the text within each legend box
        .on("mouseover", function(d) {
            div.transition()
                .duration(200)
                .style("opacity", .9);
            switch (d.key) {
                case "Military":
                    div.html("This path indicates that the participant enlisted in the military as active duty. This may also indicate that they both joined the military and enrolled in school (ROTC program, Military Academy, etc.).")
                        .style("left", "1020px")
                        .style("top", "94px")
                    break;
                case "School":
                    div.html("This path indicates that the participant enrolled in school full-time (college, university, trade school, etc.). This may also indicate that they both enrolled in school and joined the Reserves or National Guard, transferred schools, or went to another school after graduating.")
                        .style("left", "1020px")
                        .style("top", "127px");
                    break;
                case "Work":
                    div.html("This path indicates that the participant started working a full-time, non-military job. This may also indicate that they both started working a full-time job and joined the Reserves or National Guard, or it may indicate that they both worked a full-time job and enrolled in school part-time (college, university, trade school, etc.).")
                        .style("left", "1020px")
                        .style("top", "160px");
                    break;
                case "Retired":
                    div.html("This path indicates that the participant has retired and is no longer working, going to school, or in the military.")
                        .style("left", "1020px")
                        .style("top", "193px");
                    break;
                case "TBD":
                    div.html("This path indicates that the participant has not reached the next stage in their life cycle yet. This may also indicate that the participant did not wish to share the further stages of their cycle.")
                        .style("left", "1020px")
                        .style("top", "226px");
                    break;
            }
        })
        .on("mouseout", function(d) {
            div.transition()
                .duration(500)
                .style("opacity", 0);
        });


};

// Reads in JSON files based on attributes of <li> items
d3.selectAll("li")
    .on("click", function(d, i) {
        d3.select("#trail").remove();
        var folder = document.getElementsByTagName("li")[i].getAttribute('data-folder');
        console.log(folder);

        var selected = document.getElementsByTagName("li")[i].getAttribute('data-id');
        console.log(selected);

        // Because of hierarchical items, the child items in the menu
        // will return both their index value and their parents' value, the latter may throw an error

        // These two lines will prevent errors, and will also keep the sunburst 
        // from disappearing if a parent item is clicked instead of their children
        if (folder === null) return;
        if (selected === null) return;

        var json = d3.json(`/data/${folder}/${selected}.json`, function(error, data) {
            json = data;


            createVisualization(json);
        });
    });