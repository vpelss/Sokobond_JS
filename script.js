//global vars -----------------------
var error_msg = "";
var empty_chars = ["0"];
var atom_chars = ["H", "h", "O", "C", "N"];
var wall_chars = ["W"];
var modifier_chars = ["+", "-", "."];
var bond_chars = ["1", "2", "3", "4"];
var validate_board_pos = {}; //note: the keys (hyperspace,vacuum,bond_vert,bond_horiz) match state/class so we can easily do board error checking during the board build
validate_board_pos.hyperspace = empty_chars.concat(modifier_chars);
validate_board_pos.vacuum = empty_chars.concat(atom_chars, wall_chars);
validate_board_pos.bond_vert = empty_chars.concat(bond_chars);
validate_board_pos.bond_horiz = empty_chars.concat(bond_chars);
var direction = {
  N: {
    x: 0,
    y: -1
  },
  S: {
    x: 0,
    y: 1
  },
  E: {
    x: 1,
    y: 0
  },
  W: {
    x: -1,
    y: 0
  }
};

//allows us to save JSON.stringify(board) then easily rebuild each object on board.
var board = {}; //[x_y] can_be objects of type empty , atom , bond , bond_modifier
var molecule = {}; // will show which atoms are in same molecule or not : molecule[x_y] = 1 , 2 , 3 , 4 , etc. calculate before every move. It is required so we can  push / pull via bonds the atoms in our molecule IN OREDR. We do not want to treat atoms in our molecule like external atoms. ?? otherwise we could jump to our tail and push / pull in wrong direction by bonds....
var molecule_last_count; //set in call to Build_Molecules() and increases on Molecule_Split(). used so we can easily set a new molecule number when a molecule splits.
var board_mode = "game"; //or 'editor'
var move = {}; //move[x_y] = x_new_y_new , a list of all potential moves for this turn so we can simply process moves if move attempt is successful
var atom_intended_move = {}; //atoms_intended_move[xNew_yNew] = 1; allows us to easily check to see if 2 atoms trying to occupy same space (a fail condition)
var previous_boards = []; //array for z - undo and to reset board. it will contain previous_boards.push(ascii). last one is current state
var touched = {}; //this allows us to easily determine if we have already processed an atom or bond. touched[x_y]=1;
var selected_square = "0_0"; //used for editor menu. triggers square identification

//SVG graphics variables --------------------------
var svg = {};

svg["-"] = `<svg width="100%" height="100%"  viewBox="0 0 5 5">
<line x1="0" y1="2.5" x2="5" y2="2.5" style="stroke:black;stroke-width:2" />
</svg>`;

svg["+"] = `<svg width="100%" height="100%"  viewBox="0 0 5 5">
 <line x1="0" y1="2.5" x2="5" y2="2.5" style="stroke:black;stroke-width:1" />
 <line x1="2.5" y1="0" x2="2.5" y2="5" style="stroke:black;stroke-width:1" />
</svg>`;

svg["."] = `<svg width="100%" height="100%"  viewBox="0 0 5 5">
<circle cx="2.5" cy="2.5" r="1.5" stroke="black" stroke-width="1" fill="black">
</svg>`;

svg.valence_0 = ``;

svg.valence_1 = `<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 49 25 A 24 24 0 1 1 48 17 z" />
  </circle>
</svg>`;

svg.valence_2 = `<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 49 25 A 24 24 0 1 1 48 17 z" />
  </circle>
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 1 25 A 24 24 0 1 1 2 33 z" />
  </circle>
</svg>`;

svg.valence_3 = `<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 49 25 A 24 24 0 1 1 48 17 z" />
  </circle>
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 13 46 A 24 24 0 1 1 21 49 z" />
  </circle>
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 13 4 A 24 24 0 1 1 7 10 z" />
  </circle>
</svg>`;

svg.valence_4 = `<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path=" M 1 24 A 24 24 0 1 1 1 25 z" />
  </circle>
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 26 1 A 24 24 90 1 1 25 1 z" />
  </circle>
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 49 26 A 24 24 180 1 1 49 25 z" />
  </circle>
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 24 49 A 24 24 270 1 1 25 49 z" />
  </circle>
</svg>`;

svg.solid_circle = `<svg width="100%" height="100%"  viewBox="0 0 50 50"><circle cx="50%" cy="50%" r="47%" stroke="black" stroke-width="2" fill="transparent"></circle></svg>`;

svg.dash_circle = `<svg width="100%" height="100%"  viewBox="0 0 50 50"><circle cx="25" cy="25" r="24" stroke="black" stroke-width="2" stroke-dasharray="5,5" fill="transparent"></circle></svg>`;

svg.h = `<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle class="dash" cx="25" cy="25" r="24"  fill="white"></circle>
<text font-family='arial' font-color='black' x="50%" y="50%"  text-anchor="middle" stroke="black" stroke-width="1px" dy=".3em">He</text>
</svg>`;

svg.H = `<svg width="100%" height="100%" stroke="transparent" stroke-width="2" viewBox="0 0 50 50">
<circle cx="50%" cy="50%" r="47%" fill="IndianRed"></circle>
<text x="50%" y="50%" text-anchor="middle" stroke="#51c5cf" stroke-width="2px" dy=".3em">H</text>
</svg>`;

svg.O = `<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="25" cy="25" r="24"  fill="CornflowerBlue"></circle>
<text x="25" y="25" text-anchor="middle" stroke="#51c5cf" stroke-width="2px" dy=".3em">O</text>
</svg>`;

svg.N = `<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="25" cy="25" r="24" fill="LightGreen"></circle>
<text x="25" y="25" text-anchor="middle" stroke="#51c5cf" stroke-width="2px" dy=".3em">N</text>
</svg>`;

svg.C = `<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="25" cy="25" r="24" fill="Khaki"></circle>
<text x="25" y="25" text-anchor="middle" stroke="#51c5cf" stroke-width="2px" dy=".3em">C</text>
</svg>`;

svg.bond_vert_1 = `<svg width="100%" height="100%"  viewBox="0 0 5 50">
 <line x1="0" y1="25" x2="5" y2="25" style="stroke:black;stroke-width:2" />
</svg>`;

svg.bond_vert_2 = `<svg width="100%" height="100%"  viewBox="0 0 5 50">
 <line x1="0" y1="17" x2="5" y2="17" style="stroke:black;stroke-width:2" />
 <line x1="0" y1="35" x2="5" y2="35" style="stroke:black;stroke-width:2" />
svg>`;

svg.bond_vert_3 = `<svg width="100%" height="100%"  viewBox="0 0 5 50">
 <line x1="0" y1="12.5" x2="5" y2="12.5" style="stroke:black;stroke-width:2" />
 <line x1="0" y1="25" x2="5" y2="25" style="stroke:black;stroke-width:2" />
 <line x1="0" y1="37.5" x2="5" y2="37.5" style="stroke:black;stroke-width:2" />
svg>`;

svg.bond_vert_4 = `<svg width="100%" height="100%"  viewBox="0 0 5 50">
 <line x1="0" y1="10" x2="5" y2="10" style="stroke:black;stroke-width:2" />
 <line x1="0" y1="20" x2="5" y2="20" style="stroke:black;stroke-width:2" />
 <line x1="0" y1="30" x2="5" y2="30" style="stroke:black;stroke-width:2" />
 <line x1="0" y1="40" x2="5" y2="40" style="stroke:black;stroke-width:2" />
svg>`;

svg.bond_horiz_1 = `<svg width="100%" height="100%"  viewBox="0 0 50 5">
 <line x1="25" y1="0" x2="25" y2="5" style="stroke:black; stroke-width:2" />
</svg>`;

svg.bond_horiz_2 = `<svg width="100%" height="100%"  viewBox="0 0 50 5">
 <line x1="17" y1="0" x2="17" y2="5" style="stroke:black; stroke-width:2" />
 <line x1="35" y1="0" x2="35" y2="5" style="stroke:black; stroke-width:2" />
</svg>`;

svg.bond_horiz_3 = `<svg width="100%" height="100%"  viewBox="0 0 50 5">
 <line x1="12.5" y1="0" x2="12.5" y2="5" style="stroke:black; stroke-width:2" />
 <line x1="25" y1="0" x2="25" y2="5" style="stroke:black; stroke-width:2" />
 <line x1="37.5" y1="0" x2="37.5" y2="5" style="stroke:black; stroke-width:2" />
</svg>`;

svg.bond_horiz_4 = `<svg width="100%" height="100%"  viewBox="0 0 50 5">
 <line x1="10" y1="0" x2="10" y2="5" style="stroke:black; stroke-width:2" />
 <line x1="20" y1="0" x2="20" y2="5" style="stroke:black; stroke-width:2" />
 <line x1="30" y1="0" x2="30" y2="5" style="stroke:black; stroke-width:2" />
 <line x1="40" y1="0" x2="40" y2="5" style="stroke:black; stroke-width:2" />
</svg>`;

svg.win = `<table>
<tr>
<td class="win_vacuum">

<svg width="100%" height="100%" stroke="transparent" stroke-width="2" viewBox="0 0 50 50">
<circle cx="50%" cy="50%" r="47%" fill="IndianRed"></circle>
<text x="50%" y="50%" text-anchor="middle" stroke="#51c5cf" stroke-width="2px" dy=".3em">W</text>
</svg>

<svg width="100%" height="100%"  viewBox="0 0 50 50"><circle cx="25" cy="25" r="24" stroke="black" stroke-width="2" stroke-dasharray="5,5" fill="transparent"></circle></svg>

<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 49 25 A 24 24 0 1 1 48 17 z" />
  </circle>
</svg>

</td>
<td class="win_bond_vert">

<svg width="100%" height="100%"  viewBox="0 0 5 50">
 <line x1="0" y1="25" x2="5" y2="25" style="stroke:black;stroke-width:2" />
</svg>

</td>
<td class="win_vacuum">
<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="25" cy="25" r="24"  fill="CornflowerBlue"></circle>
<text x="25" y="25" text-anchor="middle" stroke="#51c5cf" stroke-width="2px" dy=".3em">I</text>
</svg>

<svg width="100%" height="100%"  viewBox="0 0 50 50"><circle cx="50%" cy="50%" r="47%" stroke="black" stroke-width="2" fill="transparent"></circle></svg>
<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 49 25 A 24 24 0 1 1 48 17 z" />
  </circle>
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 1 25 A 24 24 0 1 1 2 33 z" />
  </circle>
</svg>

</td>
</tr>

<tr>
<td class="win_bond_horiz"></td>
<td class="win_bond_hyperspace"></td>
<td class="win_bond_horiz">

<svg width="100%" height="100%"  viewBox="0 0 50 5">
 <line x1="25" y1="0" x2="25" y2="5" style="stroke:black; stroke-width:2" />
</svg>

</td>
</tr>

<tr><td class="win_vacuum">
</td>
<td class="win_bond_vert">
</td>
<td class="win_vacuum">

<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="25" cy="25" r="24" fill="Khaki"></circle>
<text x="25" y="25" text-anchor="middle" stroke="#51c5cf" stroke-width="2px" dy=".3em">N</text>
</svg>

<svg width="100%" height="100%"  viewBox="0 0 50 50"><circle cx="50%" cy="50%" r="47%" stroke="black" stroke-width="2" fill="transparent"></circle></svg>

<svg width="100%" height="100%"  viewBox="0 0 50 50">
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path=" M 1 24 A 24 24 0 1 1 1 25 z" />
  </circle>
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 26 1 A 24 24 90 1 1 25 1 z" />
  </circle>
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 49 26 A 24 24 180 1 1 49 25 z" />
  </circle>
<circle cx="0" cy="0" r="5" stroke="black" stroke-width="2" fill="white">
<animateMotion dur="10s" repeatCount="indefinite"
      path="M 24 49 A 24 24 270 1 1 25 49 z" />
  </circle>
</svg>

</td>
</tr>
<table>`;

//alert vars -----------------------------
var how_to_play = `
Chemical Zen needs no instruction...

cursor/arrows=move : or click dashed boxes
r: reset puzzle
z: undo current move

Goal: Join all atoms with free valences
`;

var building_a_puzzle = `Building puzzles in ASCII:
-the first line is an x_y value indicating the location of the atom you will control
-the following lines are the columns and rows of the puzzle
-the top left is x=0 , y=0 x being columns and y being rows
-characters can be W,0,1,2,3,4,h,H,O,N,C,+,-,.
-W = walls -they must be in locations where x and y are both even
-0 (zero) = empty -they can go anywhere
1,2,3,4 = bonds -they can go anywhere between two atoms, up to the capacity of the smallest valence. x and y must be even/odd or odd/even
h = helium -It has no free valence bonds and cannot join to other atoms. It must be in locations where x and y are both even
H = hydrogen -It has 1 free valence bonds. It must be in locations where x and y are both even
O = oxygen -It has 2 free valence bonds. It must be in locations where x and y are both even
N = nitrogen -It has 3 free valence bonds. It must be in locations where x and y are both even
C = carbon -It has 4 free valence bonds. It must be in locations where x and y are both even
+ = bond adder -bonds crossing this will increase by 1 if the atoms have free valences
- = bond subtractor -bonds crossing this will decrease by 1
. = bond twister - bonds crossing this will wrap around it `;

//puzzle vars ------------------------
var puzzles = {};

puzzles.lotus = `8_2
000000W0W0W000000
00000000000000000
0000W0W0C0W0W0000
00000000000000000
00W0W0000000W0W00
00000000000000000
W0W000H000H000W0W
00000000000000000
W000000000000000W
00000000000000000
W0W000H000H000W0W
00000000000000000
00W0W0000000W0W00
00000000000000000
0000W0W000W0W0000
00000000000000000
000000W0W0W000000
`;

puzzles.rosie = `8_12
W0W0W0W0W0W0W0W0W
00000000000000000
W000000000000000W
00000000000000000
W000H000C000H000W
00000000000000000
W000000000000000W
00000000000000000
W000H000W000H000W
00000000000000000
W000000000000000W
00000000000000000
W000H000C000H000W
00000000000000000
W000000000000000W
00000000000000000
W0W0W0W0W0W0W0W0W
`;

puzzles.three_doors = `8_10
W0W0W0W0W0W0W0W0W
00000000000000000
W000000000000000W
00000000000000000
W000000000000000W
00000000000000000
W0W0H0W0C0W0H0W0W
00000000000000000
W000000000000000W
00000000000000000
W00000H0h0H00000W
00000000000000000
W000000000000000W
00000000000000000
W0W0W0W0W0W0W0W0W
`;

puzzles.long_legs = `2_4
00W0W0W0W0W0W0W00
00000000000000000
W0W00000000000W0W
000-000000000-000
W0H00000000000H0W
000-000000000-000
W0W00000C00000W0W
00000-0-0-0-00000
00W0W000W000W0W00
00000000000000000
0000W0H0W0H0W0000
00000000000000000
0000W0W0W0W0W0000
`;

puzzles.construction = `2_2
W0W0W0W0W0W0W0W
000000000000000
W0H000000000H0W
000.0.0.0.0.000
W000O000000000W
000.0.0.0.0.000
W0000000000000W
000.0.0-0.0.000
W0000000000000W
000.0.0.0.0.000
W000000000C000W
000.0.0.0.0.000
W0H000000000H0W
000000000000000
W0W0W0W0W0W0W0W
`;

//constructors ------------------------

function Atom(x, y, letter) {
  // Constructor
  this.is_a = "atom";
  this.x = x;
  this.y = y;
  this.letter = letter; //H, h, O, N, C
  this.valence = {
    h: 0,
    H: 1,
    O: 2,
    N: 3,
    C: 4
  }[letter]; //set on create based on letter
  this.forces = {};//keep a record of all attempted forces on this atom. If there are two conflicting forces, return a fail. must erase after a move

  if (x <= 0 || y <= 0 || x >= board.width || y >= board.hight) {
    //atoms cannot exist on edge. Only walls.
    alert("Atom cannot go on the edge");
    return new Empty(x, y, "0"); // return empty instead
  }

  this.Build_Molecules = function (molecule_number) {
    let x_y = this.x.toString() + "_" + this.y.toString();
    if (typeof molecule[x_y] != "undefined") {
      return false;
    } //x_y is already part of (this?) molecule. step back in search tree
    molecule[x_y] = molecule_number;
    let all_news = Get_NEWS(this.x, this.y);
    for (let key in direction)
      if (direction.hasOwnProperty(key)) {
        //N,S,E,W
        let x_y_half_step = all_news[key].x_y_half_step;
        let x_y_full_step = all_news[key].x_y_full_step;
        if (board[x_y_half_step].is_a == "bond") {
          //there is a bond
          if (board[x_y_full_step].is_a === "atom") {
            //this is a bonded atom!
            board[x_y_full_step].Build_Molecules(molecule_number); //add it to the current molecule
          }
        }
      }
    return true; //NEWS search tree has been processed and all joined atoms added to molecule
  };

  this.Molecule_Split = function (molecule_number) {
    //after a bond split, this will change the molecule # for all bonded atoms to this atom. the other side of the split molecule retains the old molecule #
    let x_y = this.x.toString() + "_" + this.y.toString();
    if (molecule[x_y] == molecule_number) {
      return false;
    } //x_y is already part of this molecule. (needed for bond loops)
    molecule[x_y] = molecule_number;
    let all_news = Get_NEWS(this.x, this.y);
    for (let key in direction)
      if (direction.hasOwnProperty(key)) {
        //N,S,E,W
        let x_y_half_step = all_news[key].x_y_half_step;
        let x_y_full_step = all_news[key].x_y_full_step;
        if (board[x_y_half_step].is_a == "bond") {
          //there is a bond
          if (board[x_y_full_step].is_a === "atom") {
            //this is a bonded atom!
            board[x_y_full_step].Molecule_Split(molecule_number);
          }
        }
      }
    return true;
  };

  this.Can_I_Move = function (force) {
    //NEWS is the force in direction N,E,W or S
    let x_y = this.x.toString() + "_" + this.y.toString();
    let all_news = Get_NEWS(this.x, this.y);
    let x_y_half_step = all_news[force].x_y_half_step;
    let x_y_full_step = all_news[force].x_y_full_step;

    //this was added for a snake eating tail case, where a bond is hitting a rotator. No error would trigger, and the move would break the loop.
    //but this check is a logical check that should have been included anyway.
    this.forces[force] = 1;//record all forces that push/pull on this atom.
    if( Object.keys(this.forces).length > 1 ){//If there are two or more, they are conflicting forces, so we should return a false.
      return false;
      }

    if (touched[x_y] === 1) {//this x_y has already been visited/processed. If it had not already replied false, then it must have been true.
      return true;
    }
    touched[x_y] = 1; //else: set this touched{x_y}=1 so we don't recurse into this atom again and create infinite loops

    //1. check for a wall hit
    if (board[x_y_full_step].is_a === "wall") {
      return false;
    }

    //2. check to see if another atom is moving to the same location
    if (atom_intended_move[x_y_full_step]) {
      //another atom is already moving here. fail
      return false;
    }

    //3. state atom's intention of moving here
    atom_intended_move[x_y_full_step] = 1; //used to ensure 2 atoms are not fighting to move to same space

     //Logic
    //a) each visited atom (Including our atom) will create a list of bonds,
    //b) the atom will choose an unchecked bond, transmit the force (direction), and move to the next atom. See the bond object for bond modifier effects.
    //c) when we reach an atom at the end of a branch (no more unchecked bonds), we check for an un-bonded atom in the direction of the force to this atom.
    //d) we attempt to  transmit the force (direction) to this un-bonded atom and await a true/false result
    //e) if true we then backtrack to the previous atom and go to step b)
    //f) note: false should always return us as directly as possible to the first atom

    //4. step b) above
    //note: we must not do the PUSH bond first. If we do, a rotator condition with a snake eating it's tail will fail.
    let news_temp = ['N','E','W','S'];
    news_temp.push( news_temp.splice(news_temp.indexOf(force) , 1) ); //find force in array, then remove it, and add it to the end
    for(let key of news_temp)
    //for (let key in all_news)
      if (all_news.hasOwnProperty(key)) {
        let x_y_half_step = all_news[key].x_y_half_step;
        let receiving_atom = all_news[key].x_y_full_step; //is where receiving atom is
        if (board[x_y_half_step].is_a === "bond") {
          if ( board[x_y_half_step].Can_I_Move(force, key, x_y, receiving_atom) === false ) {//something downstream cannot move
            return false;
          }
        }
      }

    //5. so now we see if non bonded atom, not touched, is in our way, then see if it can move
    //steps c) & d) above
    if (board[x_y_half_step].is_a !== "bond") {
      //no bond in our way
      if (board[x_y_full_step].is_a === "atom") {
        //atom in our way
        if (touched[x_y_full_step] !== 1) {//has not been touched
          //if (molecule[x_y] != molecule[x_y_full_step]) //ONLY PUSH atoms that are not in our molecule as we can't (should not) push atoms in our molecule
          //vinman issue: previously we have assumed molecule will move as a solid unit
          //when we split a molecule, the transmitting molecule might need to push the receiving atom. We cannot control if the split will occur fist!!!!!!!!
          //if we remove this condition to fix, will it cause other issues?
          {
						if (!board[x_y_full_step].Can_I_Move(force)) {
							return false;
						}
					}
        }
      }
    }

    //if we are here, all downstream tests are good to move for this atom (based on current completed search tree).
    //but this does not mean that the move will not fail due to another upcoming branch of the search tree
    //so do not update this.x and this.y yet. only do it later, when we move all atoms at once.
    move[x_y] = x_y_full_step; //this is used to move atoms later, if we are good to go
    return true;
  };

  this.Join_To_Free_Atoms = function () {
    //original sokobond 'seems' to attach to atoms with a higher free valance value first. we may need to do this too. see sokobond's gold - chandelier
    //to do this find largest to smallest free valances around us and make a NEWS_sorted_array we can use in for (var key in all_news) eg: for (var key in all_news_sorted_array)
    var NEWS_valances = {};
    var all_news_sorted_array = []; //pop?
    let all_news = Get_NEWS(this.x, this.y);
    for (var key in all_news)
      if (all_news.hasOwnProperty(key)) {
        let x_y_full_step = all_news[key].x_y_full_step;
        if (board[x_y_full_step].is_a === "atom") {
          NEWS_valances[key] = board[x_y_full_step].Return_Free_Valence();
        }
      }
    //sort the valences high to low
    all_news_sorted_array = Object.entries(NEWS_valances)
      .sort((a, b) => b[1] - a[1])
      .map((el) => el[0]);

    let free_valence = this.Return_Free_Valence(); //get free valence value of this atom
    //for adjacent atoms with free valances, add one bond to each atom until my atom's free_valence === 0
    all_news = Get_NEWS(this.x, this.y);
    for (key of all_news_sorted_array) {
      //using sorted NEWS based on valences above
      if (free_valence <= 0) {
        return;
      }
      let x_half_step = all_news[key].x_half_step;
      let y_half_step = all_news[key].y_half_step;
      let x_y_half_step = all_news[key].x_y_half_step;
      let x_y_full_step = all_news[key].x_y_full_step;
      if (board[x_y_full_step].is_a === "atom") {
        if (board[x_y_full_step].Return_Free_Valence() > 0) {
          if (board[x_y_half_step].is_a === "empty") {
            sound_add_bond.play();
            board[x_y_half_step] = new Bond(x_half_step, y_half_step, 1); //add a bond
            free_valence--;
          }
        }
      }
    }
  };

  this.Return_Free_Valence = function () {
    //look in all directions and calculate
    let sum = 0;
    let free_valence;
    let all_news = Get_NEWS(this.x, this.y);
    for (let key in all_news)
      if (all_news.hasOwnProperty(key)) {
        let x_y = all_news[key].x_y_half_step;
        if (board[x_y].is_a === "bond") {
          sum = sum + parseInt(board[x_y].letter); //letter is ascii
        }
      }
    free_valence = this.valence - sum;
    if (free_valence < 0) {
      console.log("Impossible free_valence at " + x + "_" + y);
      alert("Impossible free_valence at " + x + "_" + y);
    }
    return free_valence;
  };

  return this; //return constructor
}

function Molecule_Split(transmitting_atom) {
  //called from the Bond object only and initiated by splitter severing last bond
  molecule_last_count++; //find a free molecule number
  molecule_number = molecule_last_count;
  board[transmitting_atom].Molecule_Split(molecule_number); //will change all bonded atoms to transmitting_atom, to this new molecule number. the other side of split molecule retains the old molecule number
}

function Bond(x, y, letter) {
  this.is_a = "bond";
  this.x = x;
  this.y = y;
  this.letter = letter;

  this.Can_I_Move = function (force , NEWS_incomming_direction , transmitting_atom , receiving_atom) {
    //all atom forces (N,E,W,S) MUST be transmitted in order from source to receiver
    let dx = direction[force].x;
    let dy = direction[force].y;
    let x_y = this.x.toString() + "_" + this.y.toString();
    let all_news = Get_NEWS(this.x, this.y);
    let x_y_half_step = all_news[force].x_y_half_step;

    if (touched[x_y] === 1) {//already been processed. assume it was successful
      return true;
    }
    touched[x_y] = 1; //else

    //do half the move calculation here as we may be rotating the bond (half step) OR simply moving the bond (full step).
    //if we are 'moving' dx and dy remain unchanged later
    //if 'rotating' dx and dy will be + or - 90 degrees later
    let half_move_x = this.x + dx;
    let half_move_y = this.y + dy;

    //1.is there a bond_modifyer in the path - y ?
    if (board[x_y_half_step].is_a === "bond_modifier") {
      if (board[x_y_half_step].letter === "-") {
        //reduce bond by 1. if 0, do not transmit force and return true
        board[x_y].letter--; //warning: letter is a string. but this works.
        if (board[x_y].letter <= 0) {
          sound_sub_bond.play();
          //remove bond from board
          //this may seem logically WRONG, as we are setting a board area BEFORE we are authorized to do so
          //but we need to do this (with Molecule_Split) so if our atom is split from a molecule, it can also push the split molecule at the same time
          //Note: on a fail condition the entire board is rebuilt from a previous ASCII save. so it works out
          board[x_y] = new Empty(this.x, this.y, "0");
          Molecule_Split(transmitting_atom); //split the molecule
          return true;
        }
      }

      if (board[x_y_half_step].letter === "+") {
        //bond hit a joiner
        if (
          board[transmitting_atom].Return_Free_Valence() > 0 &&
          board[receiving_atom].Return_Free_Valence() > 0
        ) {
          //if both joined atoms have free valences, join them
          sound_add_bond.play();
          board[x_y].letter++;
        }
      }

      if (board[x_y_half_step].letter === ".") {
        //bond hit a rotator
        //the rotator causes the force to change direction (done here) that will pull the receiving atom towards the last known location of the transmitting atom
        //bond will move a half move in the original force direction (N,E,W,S) (done above)
        //and also a half move in the direction of the transmitting atom (done here)
        let anti = {
          N: "S",
          S: "N",
          E: "W",
          W: "E"
        };
        force = anti[NEWS_incomming_direction];//change force direction 180
        dx = direction[force].x;
        dy = direction[force].y;
      }
    }

    if (!board[receiving_atom].Can_I_Move(force)) {
      //transmit force to receiving atom AND test for successful move for this search branch
      return false;
    }

    move[x_y] = "" + (half_move_x + dx) + "_" + (half_move_y + dy); //potentially move bond using second half of calculation, see above.
    return true;
  };

  return this;
}

function Empty(x, y, letter) {
  this.is_a = "empty";
  this.letter = letter;
  this.x = x;
  this.y = y;
  return this;
}

function Wall(x, y, letter) {
  this.is_a = "wall";
  this.x = x;
  this.y = y;
  this.letter = letter;
  return this;
}

function Bond_Modifier(x, y, letter) {
  this.is_a = "bond_modifier";
  this.x = x;
  this.y = y;
  this.letter = letter;
  return this;
  //- reduce bond by one
  //+ increase bond by one if joining atoms hav free valences
  // . if a bond hits it, the force transmitted by the bond will change to pull the receiving atom in the direction of the transmitting atom, the bond will move to
}

//board functions -----------------

function Build_Puzzle(input_string) {
  //called on load, z key, and r key.
  //if we are in a win condition, erase it
  let element = document.getElementById("win");
  element.classList.remove("win");
  element.innerHTML = "";

  if (board_mode === "game") {
    //hide or show ASCII editor box
    document.getElementById("ASCII").style.display = "none";
  } else {
    //editor mode
    document.getElementById("ASCII").style.display = "block";
  }

  ASCII_To_Objects(input_string);
  Create_Empty_HTML_Board();
  Objects_To_DOM();
}

function Create_Empty_HTML_Board() {
  let width = board.width;
  let height = board.height;
  let board_string = '<div id="puzzle_title">title</div>';
  board_string = board_string + '<table id="board_table">';
  for (let y = 0; y <= height; y++) {
    board_string = board_string + "<tr>";
    for (let x = 0; x <= width; x++) {
      var state = State(x, y);
      var x_y = X_Y_To_String(x, y);
      if (board_mode === "editor") {
        board_string =
          board_string +
          "<td id=" +
          x_y +
          ' class="' +
          state +
          ' editor" onmousedown="Editor_Menu_Show(this.id);"></td>';
      } else {
        //z and r button cases
        if (x_y === "0_0") {
          //z
          board_string =
            board_string +
            "<td id=" +
            x_y +
            ' class="move_to ' +
            state +
            '" onmousedown="Key_Input(90);"><center>z</center></td>';
        } else if (x_y === "2_0") {
          //r
          board_string =
            board_string +
            "<td id=" +
            x_y +
            ' class="move_to ' +
            state +
            '" onmousedown="Key_Input(82);"><center>r</center></td>';
        } else {
          //everything else
          board_string =
            board_string +
            "<td id=" +
            x_y +
            ' class="' +
            state +
            '" ontouchend="Mouse_Down(this.id);" onclick="Mouse_Down(this.id);"> </td>';
        }
      }
    }
    board_string = board_string + "</tr>";
  }
  board_string = board_string + "</table>";
  document.getElementById("board").innerHTML = board_string;
}

function Objects_To_DOM() {
  //html board DOM already exists. we are just scrubbing classes and innerHTML and placing Board objects on the DOM
  Build_Molecules();
  let element = document.getElementById("puzzle_title");
  element.innerHTML = board.title;
  for (let y = 0; y <= board.height; y++) {
    for (let x = 0; x <= board.width; x++) {
      //for each board space
      let x_y = X_Y_To_String(x, y);
      let letter = board[x_y].letter;

      element = document.getElementById(x_y);
      element.classList.remove("selected"); //reset possible selected classes
      element.classList.remove("me");
      element.classList.remove("wall");
      element.classList.remove("atom");
      if (x_y != "0_0" && x_y != "2_0") {
        //z r ignore so they gets dashed box
        element.classList.remove("move_to"); //reset possible move classes
      }

      //highlight possible moves with dashed box
      let news = Get_NEWS(board.x_me, board.y_me);
      if (news.N.x_y_full_step === x_y) {
        element.classList.add("move_to");
      }
      if (news.E.x_y_full_step === x_y) {
        element.classList.add("move_to");
      }
      if (news.W.x_y_full_step === x_y) {
        element.classList.add("move_to");
      }
      if (news.S.x_y_full_step === x_y) {
        element.classList.add("move_to");
      }

      if (board[x_y].is_a === "empty") {
        if (x_y != "0_0" && x_y != "2_0") {
          //z r ignore
          element.innerHTML = "";
        }
      }

      if (board[x_y].is_a === "wall") {
        if (x_y != "0_0" && x_y != "2_0") {
          //z r ignore
          element.innerHTML = "";
        }
        element.classList.add("wall");
      }

      if (board[x_y].is_a === "atom") {
        let temp = svg[letter]; //atom text and color
        if (x === board.x_me && y === board.y_me) {
          temp = temp + svg.dash_circle; //dashed circle
          element.classList.add("me");
        } else {
          temp = temp + svg.solid_circle; //normal circle
        }
        temp = temp + svg["" + "valence_" + board[x_y].Return_Free_Valence()]; //get valance
        element.innerHTML = temp;
      }

      if (board[x_y].is_a === "bond") {
        let state = State(x, y); //can't use className as it might have trailing editor
        element.innerHTML = svg["" + state + "_" + board[x_y].letter];
      }

      if (board[x_y].is_a === "bond_modifier") {
        element.innerHTML = svg[letter];
      }
    }
  }
}

//object  functions

function ASCII_To_Objects(ascii_string) {
  Prep_New_Board(); //clear objects
  ascii_string = ascii_string.trim();
  let lines = ascii_string.split("\n");

  //1st line is the ME position. Process
  let x_y_me = lines.shift().trim();
  board.x_y_me = x_y_me;
  [board.x_me, board.y_me] = String_To_X_Y(x_y_me);

  let y = -1;
  for (let line of lines) {
    line = line.trim();
    y++;
    if (y > board.height) {
      board.height = y;
    } //find the height
    var x = -1;
    for (let letter of line) {
      x++;
      if (x > board.width) {
        board.width = x;
      } //find the width
      var state = State(x, y);
      var x_y = X_Y_To_String(x, y);
      if (!validate_board_pos[state].includes(letter)) {
        var log =
          "Letter " +
          letter +
          " not allowed in " +
          state +
          " position + " +
          x_y +
          ". ";
        error_msg = error_msg + log;
        console.log(log);
      }
      //create the board[x_y] objects
      if (empty_chars.includes(letter)) {
        //0
        board[x_y] = new Empty(x, y, letter);
      }
      if (bond_chars.includes(letter)) {
        //1,2,3,4
        board[x_y] = new Bond(x, y, letter);
      }
      if (wall_chars.includes(letter)) {
        //W
        board[x_y] = new Wall(x, y, letter);
      }
      if (atom_chars.includes(letter)) {
        //h,H,N,O,C
        board[x_y] = new Atom(x, y, letter);
      }
      if (modifier_chars.includes(letter)) {
        //+,-,.
        board[x_y] = new Bond_Modifier(x, y, letter);
      }
    }
  }
  if (error_msg !== "") {
    alert(error_msg);
  }
}

function Objects_To_ASCII() {
  //convert Board object to ascii
  let ascii_string = board.x_y_me.trim() + "\r\n";
  for (let y = 0; y <= board.height; y++) {
    for (let x = 0; x <= board.width; x++) {
      ascii_string = ascii_string + board[x + "_" + y].letter;
    }
    ascii_string = ascii_string + "\r\n";
  }
  return ascii_string;
}

//editor functions -------------------------

function Blank_Editor_ASCII() {
  let x_squares = 10;
  let y_squares = 10;
  let x_size = x_squares * 2 - 2;
  let y_size = y_squares * 2 - 2;
  let ascii_text = "2_2";
  //build a blank x by y ascii. easy way to make clear board!
  for (let y = 0; y <= y_size; y++) {
    ascii_text = ascii_text + "\n";
    for (let x = 0; x <= x_size; x++) {
      ascii_text = ascii_text + "0";
    }
  }
  return ascii_text;
}

function Editor_Menu_Show(square_id) {
  //called from index.html
  let element = document.getElementById("Item_Menu");
  element.style.display = "block"; //show menu
  selected_square = square_id; //set global selected_square to allow us add item from menu to editor board later
  let [x, y] = String_To_X_Y(square_id);
  let state = State(x, y);
  //show / block menu items
  document.getElementById(square_id).classList.add("selected"); //highlight box to edit
  if (state === "vacuum") {
    document.getElementById("Item_Menu_Atoms").style.display = "block";
    document.getElementById("Item_Menu_Bonds").style.display = "none";
    document.getElementById("Item_Menu_Modifiers").style.display = "none";
  }
  if (state.includes("bond")) {
    document.getElementById("Item_Menu_Atoms").style.display = "none";
    document.getElementById("Item_Menu_Bonds").style.display = "block";
    document.getElementById("Item_Menu_Modifiers").style.display = "none";
  }
  if (state === "hyperspace") {
    document.getElementById("Item_Menu_Atoms").style.display = "none";
    document.getElementById("Item_Menu_Bonds").style.display = "none";
    document.getElementById("Item_Menu_Modifiers").style.display = "block";
  }
}

function Editor_Place_Item(letter) {
  //called from index.html
  let element = document.getElementById("Item_Menu");
  element.style.display = "none"; //hide menu

  let x_y = selected_square;
  let [x, y] = String_To_X_Y(x_y);
  if (empty_chars.includes(letter)) {
    board[x_y] = new Empty(x, y, letter);
  }
  if (bond_chars.includes(letter)) {
    board[x_y] = new Bond(x, y, letter);
  }
  if (wall_chars.includes(letter)) {
    board[x_y] = new Wall(x, y, letter);
  }
  if (atom_chars.includes(letter)) {
    board[x_y] = new Atom(x, y, letter);
  }
  if (modifier_chars.includes(letter)) {
    board[x_y] = new Bond_Modifier(x, y, letter);
  }
  //check for bonds
  Join_Free_Atoms();
  Objects_To_DOM();

  document.getElementById("input_area").value = Objects_To_ASCII();
  localStorage.editor_board = document.getElementById("input_area").value; //Save editor state
}

function Make_Me() {
  //called from index.html
  let element = document.getElementById("Item_Menu");
  element.style.display = "none"; //hide menu

  let x_y = selected_square;
  board.x_y_me = x_y;
  let [x, y] = String_To_X_Y(x_y);
  board.x_me = x;
  board.y_me = y;
  Objects_To_DOM(); //need to redraw to update svg
  document.getElementById("input_area").value = Objects_To_ASCII();
  localStorage.editor_board = document.getElementById("input_area").value; //Save editor state
}

function Crop_Editor_Board() {
  //called from index.html
  let left_wall = 0;
  let x_size = board.width;
  let right_wall = board.width;
  let top_wall = 0;
  let y_size = board.height;
  let bottom_wall = board.height;
  let trigger;
  //find left wall
  trigger = false;
  for (x = 0; x <= x_size; x++) {
    //calc left_wall
    for (y = 0; y <= y_size; y++) {
      if (board[x + "_" + y].is_a != "empty") {
        trigger = true;
        break;
      }
    }
    if (trigger == true) {
      break;
    }
  }
  left_wall = x;
  //find right wall
  trigger = false;
  for (x = x_size; x >= 0; x--) {
    //calc right_wall
    for (y = 0; y <= y_size; y++) {
      if (board[x + "_" + y].is_a != "empty") {
        trigger = true;
        break;
      }
    }
    if (trigger == true) {
      break;
    }
  }
  right_wall = x;
  //find top wall
  trigger = false;
  for (y = 0; y <= y_size; y++) {
    //calc top_wall
    for (x = 0; x <= x_size; x++) {
      if (board[x + "_" + y].is_a != "empty") {
        trigger = true;
        break;
      }
    }
    if (trigger == true) {
      break;
    }
  }
  top_wall = y;
  //find bottom wall
  trigger = false;
  for (y = y_size; y >= 0; y--) {
    //calc bottom_wall
    for (x = 0; x <= x_size; x++) {
      if (board[x + "_" + y].is_a != "empty") {
        trigger = true;
        break;
      }
    }
    if (trigger == true) {
      break;
    }
  }
  bottom_wall = y;
  //convert x_y_me_editor to x_y_me based on top_wall and left_wall
  [x, y] = String_To_X_Y(board.x_y_me);
  board.x_y_me = x - left_wall + "_" + (y - top_wall);
  //crop and convert to ascii
  let ascii_string = board.x_y_me.trim() + "\n";
  for (y = top_wall; y <= bottom_wall; y++) {
    for (x = left_wall; x <= right_wall; x++) {
      ascii_string = ascii_string + board[x + "_" + y].letter;
    }
    ascii_string = ascii_string + "\n";
  }

  //save to input_box
  document.getElementById("input_area").value = ascii_string;
  localStorage.editor_board = document.getElementById("input_area").value; //Save editor state
  Build_Puzzle(ascii_string); //draw changes
}

//general functions -------------------------

function Prep_New_Board() {
  board = {};
  board.x_me = 0;
  board.y_me = 0;
  board.width = 0;
  board.height = 0;
  move = {};
  atom_intended_move = {};
  touched = {};
  error_msg = "";
}

//I think sokobond bonds to the biggest nearby free valance first. See chandelier puzzle.
//fixed with reservations. seems like cheating!
function Join_Free_Atoms() {
  //only call if we change something. like a move, or an edit
  if (board[board.x_y_me].is_a === "atom") {
    //do me first
    board[board.x_y_me].Join_To_Free_Atoms();
  }
  for (let key in board) {
    if (board[key].is_a === "atom") {
      //then do all other atoms
      board[key].Join_To_Free_Atoms();
    }
  }
}

function Build_Molecules() {
  //only called from Objects_To_DOM(), a function called each time we create, load, or modify a board
  molecule = {};
  var molecule_count = 0;
  for (let y = 0; y <= board.height; y++) {
    for (let x = 0; x <= board.width; x++) {
      let x_y = x + "_" + y;
      if (board[x_y].is_a === "atom") {
        if (typeof molecule[x_y] == "undefined") {
          //we have found an atom that is not part of a molecule yet
          molecule_count++; //if we are here, this must be a brand new molecule
          board[x_y].Build_Molecules(molecule_count); //atom object routine will add all bonded atoms to this molecule
        }
      }
    }
  }
  molecule_last_count = molecule_count; //save molecule_last_count for Molecule_Split()
}

function win_routine() {
  sound_win.play();
  let element = document.getElementById("win");
  element.innerHTML = svg.win;
  element.classList.add("win");
}

function Check_For_Win() {
  //win condition is no free valances on the board. could add condition of one single molecule, but I think one sokobond puzzle allows this.
  let free_valences = 0;
  for (let key in board) {
    if (board[key].is_a === "atom") {
      free_valences = free_valences + board[key].Return_Free_Valence();
    }
  }
  if (free_valences === 0) {
    //winner winner chicken diner
    setTimeout(win_routine, 1000);
  }
}

function X_Y_To_String(x, y) {
  return x.toString() + "_" + y.toString();
}

function String_To_X_Y(x_y) {
  //returns [x,y] int
  if (typeof x_y === "undefined") {
    return [0, 0];
  }
  let x, y;
  [x, y] = x_y.split("_");
  return [parseInt(x), parseInt(y)];
}

function Get_NEWS(x, y) {
  let news = {};
  for (let key in direction)
    if (direction.hasOwnProperty(key)) {
      let dx = direction[key].x;
      let dy = direction[key].y;
      let x_half_step = x + dx;
      let y_half_step = y + dy;
      let x_full_step = x + dx + dx;
      let y_full_step = y + dy + dy;
      let x_y_half_step = x_half_step + "_" + y_half_step;
      let x_y_full_step = x_full_step + "_" + y_full_step;
      news[key] = {};
      news[key].x_half_step = x_half_step;
      news[key].y_half_step = y_half_step;
      news[key].x_full_step = x_full_step;
      news[key].y_full_step = y_full_step;
      news[key].x_y_half_step = x_y_half_step;
      news[key].x_y_full_step = x_y_full_step;
    }
  return news;
}

function State(x, y) {
  //determine the x_y class and object options
  let x_odd = x % 2;
  let y_odd = y % 2;
  if (x_odd && y_odd) {
    return "hyperspace";
  }
  if (!x_odd && !y_odd) {
    return "vacuum";
  }
  if (x_odd && !y_odd) {
    return "bond_vert";
  }
  if (!x_odd && y_odd) {
    return "bond_horiz";
  }
}

//https://www.w3schools.com/graphics/game_sound.asp
function sound(src) {
  this.sound = document.createElement("audio");
  this.sound.src = src;
  this.sound.setAttribute("preload", "auto");
  this.sound.setAttribute("controls", "none");
  this.sound.style.display = "none";
  document.body.appendChild(this.sound);
  this.play = function () {
    this.sound.play();
  };
  this.stop = function () {
    this.sound.pause();
  };
}

var sound_fail = new sound(
  "https://www.emogic.com/mine/Sokobond_JS/Windows Critical Stop.mp3"
);
var sound_add_bond = new sound(
  "https://www.emogic.com/mine/Sokobond_JS/Windows Hardware Insert.mp3"
);
var sound_sub_bond = new sound(
  "https://www.emogic.com/mine/Sokobond_JS/Windows Hardware Remove.mp3"
);
var sound_win = new sound(
  "https://www.emogic.com/mine/Sokobond_JS/Windows Notify Calendar.mp3"
);
var sound_move = new sound(
  "https://www.emogic.com/mine/Sokobond_JS/Windows Balloon.mp3"
);

function Mouse_Down(x_y) {
  //called from index.html
  let news;
  news = Get_NEWS(board.x_me, board.y_me);
  if (news.N.x_y_full_step === x_y) {
    Key_Input(38);
  }
  if (news.E.x_y_full_step === x_y) {
    Key_Input(39);
  }
  if (news.W.x_y_full_step === x_y) {
    Key_Input(37);
  }
  if (news.S.x_y_full_step === x_y) {
    Key_Input(40);
  }
}

//main routine Key input --------------------------

function Key_Input(keyCode) {
  if (document.activeElement === document.getElementById("input_area")) {
    return;
  }
  if (keyCode == 82) {
    //r 82
    Build_Puzzle(previous_boards[0]);
    previous_boards = previous_boards.slice(0, 1); //only keep the first array element
    Save_State();
    return;
  }
  if (keyCode == 90) {
    //z:undo
    if (previous_boards.length > 1) {
      previous_boards.pop(); //last array item is current puzzle. remove it
      Build_Puzzle(previous_boards[previous_boards.length - 1]);
      Save_State();
      return; //do not hit move routine
    }
  }
  let move_key_pressed = false;
  let force;
  if (keyCode == 37) {
    //left
    force = "W";
    move_key_pressed = true;
  }
  if (keyCode == 38) {
    //up
    force = "N";
    move_key_pressed = true;
  }
  if (keyCode == 39) {
    //right
    force = "E";
    move_key_pressed = true;
  }
  if (keyCode == 40) {
    //down
    force = "S";
    move_key_pressed = true;
  }
  if (move_key_pressed) {
    //clear some variables to get ready for another move
    move = {};
    atom_intended_move = {};
    touched = {};

    let premove_board = Objects_To_ASCII(); //so we can perfectly reset board on a failed move. It is required so we can have our atom that splits from a molecule push the molecule

    if (board[board.x_me + "_" + board.y_me].Can_I_Move(force)) {
      //we can move!
      sound_move.stop();
      sound_move.play(); //make a happy sound

      //all moves are in move[x_y] = 'x_y_new'
      //NOTE: in the 'board' object, we are moving references to objects. So we must move the reference to those objects
      //we cannot simple move all the references at once. If we move a reference to board[x_y] that contains another reference to be moved, it will be overwritten and lost
      //to solve this we copy all object references to be moved to 'temp' and wipe the board[x_y] reference. Then we copy the object references stored in temp to their new board[x_y] locations
      //for all moves in 'move', temp[x_y]  = board[x_y] then board[x_y] = new Empty(x,y,"0")
      //for all moves in 'move', board[x_y_new] = temp[x_y]
      let temp = {};
      let key;
      for (key in move) //save a temp reference for all moving board objects. then remove the board references (set to empty)
        if (move.hasOwnProperty(key)) {
          temp[key] = board[key];
          let [x, y] = String_To_X_Y(key);
          board[key] = new Empty(x, y, "0");
        }
      for (key in move) //now set all moved board references
        if (move.hasOwnProperty(key)) {
          let new_x_y = move[key];
          board[new_x_y] = temp[key];
          [board[new_x_y].x, board[new_x_y].y] = String_To_X_Y(new_x_y); //set atom or bond this.x , this.y to new values
        }
      //move the ME variable
      board.x_y_me = move[board.x_me + "_" + board.y_me];
      [board.x_me, board.y_me] = String_To_X_Y(board.x_y_me);
      Join_Free_Atoms(); //for every atom, check for atoms that can bond
      //save board state
      let temp_ASCII = Objects_To_ASCII();
      previous_boards.push(temp_ASCII); //for z - undo
      ASCII_To_Objects(temp_ASCII); //this is here mainly to clear all the atom.forces, but will reset all board objects an reset their values.
    } else {
      //move failed
      //nothing has moved, but reset board objects with last board state as some x,y may be wrong. there may be bugs in my code ;)
      sound_fail.play(); //make a sad sound
      ASCII_To_Objects(premove_board);
    }
    Objects_To_DOM();
    Save_State();
    Check_For_Win();
  }
}

//load and save routines ------------------------------------------

function Save_State() {
  if (supports_html5_storage() == false) {
    return;
  }
  try {
    localStorage.previous_boards = JSON.stringify(previous_boards);
  } catch (err) {
    //Block of code to handle errors
    console.log(err + " out lof local storage space. Lots of moves Batman!");
    previous_boards.shift(); //remove 2 moves
    previous_boards.shift();
    Save_State(); //try agian. Is this wise?
  } finally {
  }
}

function supports_html5_storage() {
  try {
    return "localStorage" in window && window.localStorage !== null;
  } catch (e) {
    return false;
  }
}

function Load_Puzzle(puzzle) {
  board_mode = "game";
  document.getElementById("input_area").value = puzzles[puzzle];
  previous_boards = [];
  previous_boards.push(puzzles[puzzle]);
  Build_Puzzle(puzzles[puzzle]);
  board.title = puzzle;
  Objects_To_DOM();
  Save_State();
}

function Factory_Reset() {
  previous_boards.splice(0, previous_boards.length); //delete array
  delete localStorage.editor_board;
  delete localStorage.previous_boards;
}

//main start up routines
function Game() {
  var ascii;
  board_mode = "game";

  if (!supports_html5_storage()) {
    alert("This browser does not support HTML 5 localStorage");
    return;
  }

  if (
    typeof localStorage.previous_boards !== "undefined" &&
    localStorage.previous_boards !== []
  ) {
    previous_boards = JSON.parse(localStorage.previous_boards);
    ascii = previous_boards[previous_boards.length - 1]; //last array item is current puzzle
    document.getElementById("input_area").value = previous_boards[0]; //get board start state to store in editor
    Build_Puzzle(ascii);
  } else {
    let name = Object.keys(puzzles)[0]; //returns first game name in puzzles
    ascii = puzzles[name];
    document.getElementById("input_area").value = ascii;
    Build_Puzzle(ascii);
    previous_boards = [];
    previous_boards.push(ascii);
    Save_State();
  }
}

function Editor() {
  board_mode = "editor";
  let ascii_text;
  if (typeof localStorage.editor_board === "undefined") {
    // no stored editor
    ascii_text = Blank_Editor_ASCII();
  } else {
    //stored editor
    ascii_text = localStorage.editor_board;
  }
  document.getElementById("input_area").value = ascii_text;
  Build_Puzzle(ascii_text);
  localStorage.editor_board = ascii_text;
}

//free roaming global code ----------------------------

Game();

//build puzzle selection drop down from puzzles object
var keys = Object.keys(puzzles);
for (var key of keys) {
  let select_box = document.getElementById("puzzle_select");
  let option = document.createElement("option");
  option.text = key;
  option.value = key;
  select_box.add(option);
}

//disable arrow keys from scrolling page
window.addEventListener(
  "keydown",
  function (e) {
    // space and arrow keys
    if ([32, 37, 38, 39, 40].indexOf(e.keyCode) > -1) {
      e.preventDefault();
    }
  },
  false
);