// form fields to fill
var fillFields = ['surgery_bin']

// prescriptions with mme conversion
var prescriptions = {
    'codeine': 0.15,
    'hydrocodone': 1,
    'hydromorphone': 4,
    'morphine': 1,
    'oxycodone': 1.5,
    'oxymorphone': 3
};

function fillForm(csv){
    var $worksheetInput = $('#worksheetInput');
 
    for(var f = 0, fmax = fillFields.length; f < fmax; f++){
        var field = fillFields[f];
        var options = [];
    
        // get values from csv
        for(var i = 0, imax = csv.length; i < imax; i++){
            var value = csv[i][field];
            // make sure value is not already in array (prevent duplicates)
            if(value && options.indexOf(value) < 0){
                options.push(value);
            }
        }
        
        // put values in select
        populateSelect(field + '_select', options);
    }
    
    // prescription selection
    for(var drug in prescriptions){
        $('#prescriptionDrug').append($('<option>').val(drug).html(drug));
    }
    
    // surgery select
    $('#surgery_bin_select').change(function(){
        var surgery = $(this).find(":selected").text();
        var approaches = [];
        
        for(var i = 0, imax = csv.length; i < imax; i++){
            row = csv[i];
            approach = row['approach'];
            
            if(row['surgery_bin'] == surgery && approaches.indexOf(approach) < 0){
                approaches.push(approach);
            }
        }
        
        populateSelect('approachSelect', approaches, true);
    });
    
    // button clicks
    $('#updateBtn').click(function(evt){
        evt.preventDefault();
        
        var formObj = jsonifyForm($worksheetInput);
        var csvMatch = matchToCsv(formObj, csv);
        
        if(csvMatch){
            var selection = mergeObjects(csvMatch, formObj);
            
            console.log(selection);
        
            updateText(selection);
            updateImages(selection);
            
            createCalendar(selection);
        }
    });
    
    $('#clearBtn').click(function(evt){
        $worksheetInput.trigger('reset');
        $('#refillPerc').text('');
        $('#painImg').removeAttr('src');
        $('#calendar').empty();
        $('#approachSelect').empty();
    });
    
    $('#printBtn').click(function(evt){
        evt.preventDefault();
        window.print()
    });
}

function populateSelect(id, options, empty = false){
    var $select = $('#' + id);
    
    if(empty){ $select.empty(); }
    
    for(var i = 0, imax = options.length; i < imax; i++){
        $select.append($('<option>').html(options[i]));
    }
}

function updateText(selection){
    var refillPerc = Math.round(selection.perc_refill);
    $('#refillPerc').text(refillPerc);
}

function updateImages(selection){
    var painImgBase = 'images/PainFaces-';

    var painLevel = Math.round(selection.perc_pain_int / 10);
    painLevel = (painLevel == 0) ? 1 : painLevel
    painLevel = (painLevel == 10) ? String(painlevel) : '0' + String(painLevel);
    
    $('#painImg').attr('src', painImgBase + painLevel + '.png');
}

// turn form into json object
function jsonifyForm(form){
    var obj = {};
    
    //loop through serialized array
    $.each(form.serializeArray(), function(_, kv){
        if(obj.hasOwnProperty(kv.name)){
            obj[kv.name] = $.makeArray(obj[kv.name]);
            obj[kv.name].push(kv.value);
        } else{
            obj[kv.name] = kv.value;
        }
    });
    
    return obj;
}

// merge two objects
// must create new object or else a pointer will be returned
function mergeObjects(obj1, obj2){
    var newObj = {}
    
    Object.keys(obj1).forEach(function(key){ newObj[key] = obj1[key]; });
    Object.keys(obj2).forEach(function(key){ newObj[key] = obj2[key]; });
    
    return newObj;
}

// match current form item to item in csv
function matchToCsv(form, csv){
    for(var i = 0, imax = csv.length; i < imax; i++){
        var isMatch = true;
        var row = csv[i];
        
        // loop through form values
        for(var key in form){
            var value = form[key];
            
            // if all form values do not match all equivalent row values in csv
            if(Object.keys(row).indexOf(key) >= 0 && value != row[key]){
                isMatch = false;
            }
        }
        
        // all match
        if(isMatch){
            return row;
        }
    }
    
    return false;
}

function createCalendar(selection){
    // colors from Google material design, weight 300
    var colors = [
        '#81C784', //green
        '#FFF176', //yellow
        '#E57373' //red
    ];
    
    var minCells = 30
    
    var mmePerDay = prescriptions[selection.prescriptionDrug] * selection.prescriptionAmount;

    var cellsPerRow = 21,
        totalCells = Math.round(selection.q3_taken / mmePerDay);
        
    if(totalCells < minCells){
        totalCells = minCells;
    }
    
    var pageWidth = $('#page1').width();

    // calendar sizing
    var width = pageWidth,
        cellSize = pageWidth / cellsPerRow;
        
    // remove any previous elements
    d3.select('#calendar').selectAll('svg').remove();

    // create svg
    var svg = d3.select('#calendar')
        .selectAll('svg')
        .data([1]) // number of calendar items (years) FIXME: unnecessary
        .enter().append('svg')
            .attr('width', width)
            .attr('height', Math.ceil(totalCells / cellsPerRow) * cellSize);
        
    var rect = svg.append('g')
            .attr('fill', 'none')
            .attr('stroke', '#ccc')
        .selectAll('rect') //FIXME: unnecessary
        .data(function(d){ return Array.apply(null, {length: totalCells}).map(Number.call, Number); }) // array from 0 - length of total cells
        .enter().append('rect')
            .attr('width', cellSize)
            .attr('height', cellSize)
            .attr('x', function(d){ return (d % cellsPerRow) * cellSize; })
            .attr('y', function(d){ return Math.floor(d / cellsPerRow) * cellSize; });

    svg.selectAll('rect')
        .attr('fill', function(d, i, n){
            var curMme = i * mmePerDay;
            
            if(curMme < selection.median_taken){
                return colors[0];
            } else if(curMme < selection.q3_taken){
                return colors[1];
            } else{
                return colors[2];
            }
        });
}

// on document load
$(function(){
    d3.csv('https://raw.githubusercontent.com/whitstd/opioid-worksheet/master/aggregate_opioid.csv', function(data){
        convert = ['n', 'median_taken', 'q1_taken', 'q3_taken', 'perc_pain_int', 'perc_refill'];
        for(var i = 0, imax = convert.length; i < imax; i++){
            data[convert[i]] = +data[convert[i]];
        }
        return data; //promise
    }).then(function(csv){
        fillForm(csv);
    })
})
