// convexHull.js
import {epsilon, epsilonesque} from './epsilon';
import {Plane3D, Point2D} from './plane3D';
import {ConflictList, ConflictListNode} from './conflictList';
import {Vertex} from './Vertex';
import {Vector} from './vector';

// IN: vectors or vertices
// OUT: dot product
var dot = function(v1, v2) {
  return (v1.x * v2.x) + (v1.y * v2.y) + (v1.z * v2.z); 
}

// IN: Vertices a, b, c
export function Face (a, b, c, orient) {
  this.conflicts = new ConflictList(true);
  this.verts = [a, b, c];
  this.marked = false;
  var t = (a.subtract(b)).crossproduct(b.subtract(c));

  this.normal = new Vector(-t.x, -t.y, -t.z);
  this.normal.normalize();
  this.createEdges();
  this.dualPoint = null;

  if (orient != undefined) {
    this.orient(orient);
  }
}

// OUT: Point2D
Face.prototype.getDualPoint = function() {
  if (this.dualPoint == null) {
    var plane3d = new Plane3D(this);
    this.dualPoint = plane3d.getDualPointMappedToPlane();
  }
  return this.dualPoint;
}

Face.prototype.isVisibleFromBelow = function() {
  return (this.normal.z < -1.4259414393190911E-9);
}

Face.prototype.createEdges = function() {
  this.edges = [];
  this.edges[0] = new HEdge(this.verts[0], this.verts[1], this);
  this.edges[1] = new HEdge(this.verts[1], this.verts[2], this);
  this.edges[2] = new HEdge(this.verts[2], this.verts[0], this);
  this.edges[0].next = this.edges[1];
  this.edges[0].prev = this.edges[2];
  this.edges[1].next = this.edges[2];
  this.edges[1].prev = this.edges[0];
  this.edges[2].next = this.edges[0];
  this.edges[2].prev = this.edges[1];
}

// IN: vertex orient
Face.prototype.orient = function(orient) {
  if (!(dot(this.normal,orient) < dot(this.normal, this.verts[0]))){
    var temp = this.verts[1];
    this.verts[1] = this.verts[2];
    this.verts[2] = temp;
    this.normal.negate();
    this.createEdges();
  }
}

// IN: two vertices v0 and v1
Face.prototype.getEdge = function(v0, v1) {
  for (var i = 0; i < 3; i++) {
    if (this.edges[i].isEqual(v0, v1)) {
      return this.edges[i];
    }
  }
  return null;
}

// IN: Face face, vertices v0 and v1
Face.prototype.link = function(face, v0, v1) {
  if (face instanceof Face) {
    var twin = face.getEdge(v0, v1);
    if (twin === null) {

      console.log("ERROR: twin is null");
    }
    var edge = this.getEdge(v0, v1);
    twin.twin = edge;
    edge.twin = twin;
  } else {
    var e = face;
    var edge = this.getEdge(e.orig, e.dest);
    e.twin = edge;
    edge.twin = e;
  }
}

// IN: vertex v
Face.prototype.conflict = function(v) {
  return (dot(this.normal, v) > dot(this.normal, this.verts[0]) + epsilon);
}

Face.prototype.getHorizon = function() {
  for (var i = 0; i < 3; i++) {
    if (this.edges[i].twin !== null && this.edges[i].twin.isHorizon()) {
      return this.edges[i];
    }
  }
  return null;
}

Face.prototype.removeConflict = function() {
  this.conflicts.removeAll();
}

// IN: vertex orig, vertex dest, Face face
export function HEdge (orig, dest, face) {
  this.next = null;
  this.prev = null;
  this.twin = null;
  this.orig = orig;
  this.dest = dest;
  this.iFace = face;
}

HEdge.prototype.isHorizon = function() {
  return this.twin !== null && this.twin.iFace.marked && !this.iFace.marked;
}

// IN: array horizon
HEdge.prototype.findHorizon = function(horizon) {
  if (this.isHorizon()) {
    if (horizon.length > 0 && this === horizon[0]) {
      return;
    } else {
      horizon.push(this);
      this.next.findHorizon(horizon);
    }
  } else {
    if (this.twin !== null) {
      this.twin.next.findHorizon(horizon);
    }
  }
}

// IN: vertices origin and dest
HEdge.prototype.isEqual = function(origin, dest) {
  return ((this.orig.equals(origin) && this.dest.equals(dest)) || (this.orig.equals(dest) && this.dest.equals(origin)));
}

export function ConvexHull () {
  this.points = [];
  this.facets = [];
  this.created = [];
  this.horizon = [];
  this.visible = [];
  this.current = 0;
}

// IN: sites (x,y,z)
ConvexHull.prototype.init = function(boundingSites, sites) {
  this.points = [];
  for (var i = 0; i < sites.length; i++) {
    this.points[i] = new Vertex(sites[i].x, sites[i].y, sites[i].z, null, sites[i], false);
  }
  this.points = this.points.concat(boundingSites);
}

ConvexHull.prototype.permutate = function() {
  var pointSize = this.points.length;
  for (var i = pointSize -1; i > 0; i--) {
    var ra = Math.floor(Math.random() * i);
    var temp = this.points[ra];
    temp.index = i;
    var currentItem = this.points[i];
    currentItem.index = ra;
    this.points.splice(ra, 1, currentItem);
    this.points.splice(i, 1, temp);
  }
}

ConvexHull.prototype.prep = function() {
  if (this.points.length <= 3) {
    console.log("ERROR: Less than 4 points");
  }
  for (var i = 0; i < this.points.length; i++) {
    this.points[i].index = i;
  }

  var v0, v1, v2, v3;
  var f1, f2, f3, f0;
  v0 = this.points[0];
  v1 = this.points[1];
  v2 = v3 = null;

  for (var i = 2; i < this.points.length; i++) {
    if (!(this.linearDependent(v0, this.points[i]) && this.linearDependent(v1, this.points[i]))) {
      v2 = this.points[i];
      v2.index = 2;
      this.points[2].index = i;
      this.points.splice(i, 1, this.points[2]);
      this.points.splice(2, 1, v2);
      break;
    }
  }
  if (v2 === null) {
    console.log("ERROR: v2 is null");
  }

  f0 = new Face(v0, v1, v2);
  for (var i = 3; i < this.points.length; i++) {
    if (dot(f0.normal, f0.verts[0]) !== dot(f0.normal, this.points[i])) {
      v3 = this.points[i];
      v3.index = 3;
      this.points[3].index = i;
      this.points.splice(i, 1, this.points[3]);
      this.points.splice(3, 1, v3);
      break;
    }
  }
  if (v3 === null) {
    console.log("ERROR: v3 is null");
  }

  f0.orient(v3);
  f1 = new Face(v0, v2, v3, v1);
  f2 = new Face(v0, v1, v3, v2);
  f3 = new Face(v1, v2, v3, v0);
  this.addFacet(f0);
  this.addFacet(f1);
  this.addFacet(f2);
  this.addFacet(f3);
  // Connect facets
  f0.link(f1, v0, v2);
  f0.link(f2, v0, v1);
  f0.link(f3, v1, v2);
  f1.link(f2, v0, v3);
  f1.link(f3, v2, v3);
  f2.link(f3, v3, v1);
  this.current = 4;

  var v;
  for (var i = this.current; i < this.points.length; i++) {
    v = this.points[i];
    if (f0.conflict(v)) {
      this.addConflict(f0, v);
    }
    if (f1.conflict(v)) {
      this.addConflict(f1, v);
    }
    if (f2.conflict(v)) {
      this.addConflict(f2, v);
    }
    if (f3.conflict(v)) {
      this.addConflict(f3,v);
    }
  }
},

// IN: Faces old1 old2 and fn
ConvexHull.prototype.addConflicts = function(old1, old2, fn) {
  var l1 = old1.conflicts.getVertices();
  var l2 = old2.conflicts.getVertices();
  var nCL = [];
  var v1, v2;
  var i, l;
  i = l = 0;
  // Fill the possible new Conflict List
  while (i < l1.length || l < l2.length) {
    if (i < l1.length && l < l2.length) {
      v1 = l1[i];
      v2 = l2[l];
      // If the index is the same, it's the same vertex and only 1 has to be added
      if (v1.index === v2.index) {
        nCL.push(v1);
        i++;
        l++;
      } else if (v1.index > v2.index) {
        nCL.push(v1);
        i++;
      } else {
        nCL.push(v2);
        l++;
      }
    } else if ( i < l1.length) {
      nCL.push(l1[i++]);
    } else {
      nCL.push(l2[l++]);
    }
  }
  // Check if the possible conflicts are real conflicts
  for (var i = nCL.length - 1; i >= 0; i--) {
    v1 = nCL[i];
    if (fn.conflict(v1))
      this.addConflict(fn, v1);
  }
}

// IN: Face face, Vertex v
ConvexHull.prototype.addConflict = function(face, vert) {
  var e = new ConflictListNode(face, vert);
  face.conflicts.add(e);
  vert.conflicts.add(e);
}

// IN: Face f
ConvexHull.prototype.removeConflict = function(f) {
  f.removeConflict();
  var index = f.index;
  f.index = -1;
  if (index === this.facets.length - 1) {
    this.facets.splice(this.facets.length - 1, 1);
    return;
  }
  if (index >= this.facets.length || index < 0)
    return;
  var last = this.facets.splice(this.facets.length - 1, 1);
  last[0].index = index;
  this.facets.splice(index, 1, last[0]);
}

// IN: Face face
ConvexHull.prototype.addFacet = function(face) {
  face.index = this.facets.length;
  this.facets.push(face);
}

ConvexHull.prototype.compute = function() {
  this.prep();
  while (this.current < this.points.length) {
    var next = this.points[this.current];
    if (next.conflicts.isEmpty()) {  // No conflict, point in hull
      this.current++;
      continue;
    }
    this.created = [];  // TODO: make sure this is okay and doesn't dangle references
    this.horizon = [];
    this.visible = [];
    // The visible faces are also marked
    next.conflicts.fill(this.visible);
    // Horizon edges are orderly added to the horizon list
    var e;
    for (var jF = 0; jF < this.visible.length; jF++) {
      e = this.visible[jF].getHorizon();
      if (e !== null) {
        e.findHorizon(this.horizon);
        break;
      }
    }
    var last = null, first = null;
    // Iterate over horizon edges and create new faces oriented with the marked face 3rd unused point
    for (var hEi = 0; hEi < this.horizon.length; hEi++) {
      var hE = this.horizon[hEi];
      var fn = new Face(next, hE.orig, hE.dest, hE.twin.next.dest);
      fn.conflicts = new ConflictList(true);
      // Add to facet list
      this.addFacet(fn);
      this.created.push(fn);
      // Add new conflicts
      this.addConflicts(hE.iFace, hE.twin.iFace, fn);
      // Link the new face with the horizon edge
      fn.link(hE);
      if (last !== null)
        fn.link(last, next, hE.orig);
      last = fn;
      if (first === null)
        first = fn;
    }
    // Links the first and the last created JFace
    if (first !== null && last !== null) {
      last.link(first, next, this.horizon[0].orig);
    }
    if (this.created.length != 0) {
      // update conflict graph
      for (var f = 0; f < this.visible.length; f++) {
        this.removeConflict(this.visible[f]);
      }
      this.current++;
      this.created = [];
    }
  }
  return this.facets;
}

// IN: two vertex objects, p1 and p2
// OUT: true if they are linearly dependent, false otherwise
ConvexHull.prototype.linearDependent = function(p1, p2) {
  if (p1.x == 0 && p2.x == 0) {
    if (p1.y == 0 && p2.y == 0) {
      if (p1.z == 0 && p2.z == 0) {
        return true;
      }
      if (p1.z == 0 || p2.z == 0) {
        return false;
      }
      return true;
    }
    if (p1.y == 0 || p2.y == 0) {
      return false;
    }
    if (epsilonesque(p1.z/p1.y - p2.z/p2.y)) {
      return true;
    } else {
      return false;
    }
  }
  if (p1.x == 0 || p2.x == 0) {
    return false;
  }
  if (epsilonesque(p1.y/p1.x - p2.y/p2.x) && epsilonesque(p1.z/p1.x - p2.y/p2.x)) {
    return true;
  } else {
    return false;
  }
}

ConvexHull.prototype.clear = function() {
  this.points = [];
  this.facets = [];
  this.created = [];
  this.horizon = [];
  this.visible = [];
  this.current = 0;
}
