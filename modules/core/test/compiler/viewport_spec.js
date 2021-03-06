import {describe, xit, it, expect, beforeEach, ddescribe, iit, el} from 'test_lib/test_lib';
import {View, ProtoView} from 'core/compiler/view';
import {ViewPort} from 'core/compiler/viewport';
import {proxy, IMPLEMENTS} from 'facade/lang';
import {DOM} from 'facade/dom';
import {ListWrapper, MapWrapper} from 'facade/collection';
import {Injector} from 'di/di';
import {ProtoElementInjector, ElementInjector} from 'core/compiler/element_injector';
import {ProtoChangeDetector, ChangeDetector, Lexer, Parser} from 'change_detection/change_detection';

function createView(nodes) {
  var view = new View(null, nodes, new ProtoChangeDetector(), MapWrapper.create());
  view.init([], [], [], [], [], [], []);
  return view;
}

@proxy
@IMPLEMENTS(ChangeDetector)
class AttachableChangeDetector {
  parent;
  constructor() {
  }
  remove() {
    this.parent = null;
  }
  noSuchMethod(i) {
    super.noSuchMethod(i);
  }
}

@proxy
@IMPLEMENTS(View)
class HydrateAwareFakeView {
  isHydrated: boolean;
  nodes: List<Nodes>;
  changeDetector: ChangeDetector;
  rootElementInjectors;
  constructor(isHydrated) {
    this.isHydrated = isHydrated;
    this.nodes = [DOM.createElement('div')];
    this.rootElementInjectors = [];
    this.changeDetector = new AttachableChangeDetector();
  }

  hydrated() {
    return this.isHydrated;
  }

  hydrate(_, __, ___) {
    this.isHydrated = true;
  }

  dehydrate() {
    this.isHydrated = false;
  }

  noSuchMethod(i) {
    super.noSuchMethod(i);
  }
}

export function main() {
  describe('viewport', () => {
    var viewPort, parentView, protoView, dom, customViewWithOneNode,
        customViewWithTwoNodes, elementInjector;

    beforeEach(() => {
      dom = el(`<div><stuff></stuff><div insert-after-me></div><stuff></stuff></div>`);
      var insertionElement = dom.childNodes[1];
      parentView = createView([dom.childNodes[0]]);
      protoView = new ProtoView(el('<div>hi</div>'), new ProtoChangeDetector());
      elementInjector = new ElementInjector(null, null, null);
      viewPort = new ViewPort(parentView, insertionElement, protoView, elementInjector);
      customViewWithOneNode = createView([el('<div>single</div>')]);
      customViewWithTwoNodes = createView([el('<div>one</div>'), el('<div>two</div>')]);
    });

    describe('when dehydrated', () => {
      it('should throw if create is called', () => {
        expect(() => viewPort.create()).toThrowError();
      });
    });

    describe('when hydrated', () => {
      function textInViewPort() {
        var out = '';
        // skipping starting filler, insert-me and final filler.
        for (var i = 2; i < dom.childNodes.length - 1; i++) {
          if (i != 2) out += ' ';
          out += DOM.getInnerHTML(dom.childNodes[i]);
        }
        return out;
      }

      beforeEach(() => {
        viewPort.hydrate(new Injector([]), null);
        var fillerView = createView([el('<filler>filler</filler>')]);
        viewPort.insert(fillerView);
      });

      it('should create new views from protoView', () => {
        viewPort.create();
        expect(textInViewPort()).toEqual('filler hi');
        expect(viewPort.length).toBe(2);
      });

      it('should create new views from protoView at index', () => {
        viewPort.create(0);
        expect(textInViewPort()).toEqual('hi filler');
        expect(viewPort.length).toBe(2);
      });

      it('should insert new views at the end by default', () => {
        viewPort.insert(customViewWithOneNode);
        expect(textInViewPort()).toEqual('filler single');
        expect(viewPort.get(1)).toBe(customViewWithOneNode);
        expect(viewPort.length).toBe(2);
      });

      it('should insert new views at the given index', () => {
        viewPort.insert(customViewWithOneNode, 0);
        expect(textInViewPort()).toEqual('single filler');
        expect(viewPort.get(0)).toBe(customViewWithOneNode);
        expect(viewPort.length).toBe(2);
      });

      it('should remove the last view by default', () => {
        viewPort.insert(customViewWithOneNode);

        viewPort.remove();

        expect(textInViewPort()).toEqual('filler');
        expect(viewPort.length).toBe(1);
      });

      it('should remove the view at a given index', () => {
        viewPort.insert(customViewWithOneNode);
        viewPort.insert(customViewWithTwoNodes);

        viewPort.remove(1);

        expect(textInViewPort()).toEqual('filler one two');
        expect(viewPort.get(1)).toBe(customViewWithTwoNodes);
        expect(viewPort.length).toBe(2);
      });

      it('should detach the last view by default', () => {
        viewPort.insert(customViewWithOneNode);
        expect(viewPort.length).toBe(2);

        var detachedView = viewPort.detach();

        expect(detachedView).toBe(customViewWithOneNode);
        expect(textInViewPort()).toEqual('filler');
        expect(viewPort.length).toBe(1);
      });

      it('should detach the view at a given index', () => {
        viewPort.insert(customViewWithOneNode);
        viewPort.insert(customViewWithTwoNodes);
        expect(viewPort.length).toBe(3);

        var detachedView = viewPort.detach(1);
        expect(detachedView).toBe(customViewWithOneNode);
        expect(textInViewPort()).toEqual('filler one two');
        expect(viewPort.length).toBe(2);
      });
      
      it('should keep views hydration state during insert', () => {
        var hydratedView = new HydrateAwareFakeView(true);
        var dehydratedView = new HydrateAwareFakeView(false);
        viewPort.insert(hydratedView);
        viewPort.insert(dehydratedView);

        expect(hydratedView.hydrated()).toBe(true);
        expect(dehydratedView.hydrated()).toBe(false);
      });

      it('should dehydrate on remove', () => {
        var hydratedView = new HydrateAwareFakeView(true);
        viewPort.insert(hydratedView);
        viewPort.remove();

        expect(hydratedView.hydrated()).toBe(false);
      });

      it('should keep views hydration state during detach', () => {
        var hydratedView = new HydrateAwareFakeView(true);
        var dehydratedView = new HydrateAwareFakeView(false);
        viewPort.insert(hydratedView);
        viewPort.insert(dehydratedView);

        expect(viewPort.detach().hydrated()).toBe(false);
        expect(viewPort.detach().hydrated()).toBe(true);
      });

      it('should support adding/removing views with more than one node', () => {
        viewPort.insert(customViewWithTwoNodes);
        viewPort.insert(customViewWithOneNode);

        expect(textInViewPort()).toEqual('filler one two single');

        viewPort.remove(1);
        expect(textInViewPort()).toEqual('filler single');
      });
    });

    describe('should update injectors and parent views.', () => {
      var fancyView;
      beforeEach(() => {
        var parser = new Parser(new Lexer());
        viewPort.hydrate(new Injector([]), null);

        var pv = new ProtoView(el('<div class="ng-binding">{{}}</div>'),
          new ProtoChangeDetector());
        pv.bindElement(new ProtoElementInjector(null, 1, [SomeDirective]));
        pv.bindTextNode(0, parser.parseBinding('foo', null));
        fancyView = pv.instantiate(null);
      });

      it('hydrating should update rootElementInjectors and parent change detector', () => {
        viewPort.insert(fancyView);
        ListWrapper.forEach(fancyView.rootElementInjectors, (inj) =>
            expect(inj.parent).toBe(elementInjector));

        expect(parentView.changeDetector.children.length).toBe(1);
      });

      it('dehydrating should update rootElementInjectors and parent change detector', () => {
        viewPort.insert(fancyView);
        viewPort.remove();
        ListWrapper.forEach(fancyView.rootElementInjectors, (inj) =>
            expect(inj.parent).toBe(null));
        expect(parentView.changeDetector.children.length).toBe(0);
        expect(viewPort.length).toBe(0);
      });
    });
  });
}

class SomeDirective {
  prop;
  constructor() {
    this.prop = 'foo';
  }
}
