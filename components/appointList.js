import * as React from "react";
import { StyleSheet, View, Image, Text, Pressable } from "react-native";

const AppointList = () => {
  return (
    <View style={styles.completelistParent}>
      <View style={[styles.completelist, styles.completelistPosition]}>
        <View style={[styles.anamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>A name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>A name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>A name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>A</Text>
        </View>
        <View style={[styles.bnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.bName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>B name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>B name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>B name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>B</Text>
        </View>
        <View style={[styles.cnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>C name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>C name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>C name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>C</Text>
        </View>
        <View style={[styles.dnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>D name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>D name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>D name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>D</Text>
        </View>
        <View style={[styles.enamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>E name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>E name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>E name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>E</Text>
        </View>
        <View style={[styles.fnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>F name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>F name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>F name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>F</Text>
        </View>
        <View style={[styles.gnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>G name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>G name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>G name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>G</Text>
        </View>
        <View style={[styles.hnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>H name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>H name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>H name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>H</Text>
        </View>
        <View style={[styles.inamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>I name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>I name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>I name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>I</Text>
        </View>
        <View style={[styles.jnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>J name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>J name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>J name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>J</Text>
        </View>
        <View style={[styles.knamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>K name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>K name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>K name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>K</Text>
        </View>
        <View style={[styles.lnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>L name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>L name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>L name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>L</Text>
        </View>
        <View style={[styles.mnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>M name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>M name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>M name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>M</Text>
        </View>
        <View style={[styles.nnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>N name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>N name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>N name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>N</Text>
        </View>
        <View style={[styles.onamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>O name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>O name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>O name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>O</Text>
        </View>
        <View style={[styles.pnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>P name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>P name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>P name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>P</Text>
        </View>
        <View style={[styles.qnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Q name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Q name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Q name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>Q</Text>
        </View>
        <View style={[styles.rnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>R name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>R name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>R name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>R</Text>
        </View>
        <View style={[styles.snamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>S name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>S name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>S name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>S</Text>
        </View>
        <View style={[styles.tnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>T name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>T name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>T name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>T</Text>
        </View>
        <View style={[styles.unamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>U name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>U name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>U name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>U</Text>
        </View>
        <View style={[styles.vnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>V name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>V name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>V name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>V</Text>
        </View>
        <View style={[styles.wnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>W name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>W name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>W name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>W</Text>
        </View>
        <View style={[styles.xnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>X name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>X name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>X name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>X</Text>
        </View>
        <View style={[styles.ynamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Y name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Y name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Y name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>Y</Text>
        </View>
        <View style={[styles.znamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Z name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Z name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Z name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>Z</Text>
        </View>
        <View style={[styles.namelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 40.png"
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source="Line 41.png"
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}># name 1</Text>
          </Pressable>
          <Pressable
            style={[styles.aName2Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}># name 2</Text>
          </Pressable>
          <Pressable
            style={[styles.aName3Container, styles.containerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}># name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>#</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  completelistPosition: {
    left: "0%",
    right: "0%",
    bottom: "0%",
    position: "absolute",
    width: "100%",
  },
  namelistPosition: {
    height: "3.52%",
    left: "0%",
    right: "0%",
    position: "absolute",
    width: "100%",
  },
  anamelistLayout: {
    maxHeight: "100%",
    overflow: "hidden",
    maxWidth: "100%",
    right: "10.18%",
    width: "82.7%",
    height: "0.78%",
    left: "7.12%",
    position: "absolute",
  },
  name1ContainerPosition: {
    top: "22.48%",
    position: "absolute",
  },
  aFlexBox: {
    textAlign: "left",
    lineHeight: 22,
  },
  containerPosition: {
    position: "absolute",
    left: "7.12%",
  },
  anamelistChild: {
    height: "78.29%",
    top: "21.71%",
    backgroundColor: "rgba(30, 30, 30, 0.9)",
  },
  anamelistItem: {
    top: "42.64%",
    bottom: "56.59%",
  },
  anamelistInner: {
    top: "66.67%",
    bottom: "32.56%",
  },
  aName1: {
    height: "20.16%",
    width: "21.88%",
    fontSize: 14,
    fontFamily: "Roboto-Regular",
    color: "#8e8e93",
    display: "flex",
    alignItems: "center",
  },
  aName1Container: {
    left: "7.12%",
  },
  aName2Container: {
    top: "47.29%",
    left: "7.12%",
  },
  aName3Container: {
    top: "71.32%",
    left: "7.12%",
  },
  a: {
    fontSize: 16,
    fontWeight: "700",
    fontFamily: "Roboto-Bold",
    color: "#fff",
    left: "7.12%",
    top: "0%",
    position: "absolute",
  },
  anamelist: {
    bottom: "96.48%",
    top: "0%",
  },
  bName1Container: {
    left: "6.87%",
  },
  bnamelist: {
    top: "3.71%",
    bottom: "92.77%",
  },
  cnamelist: {
    top: "7.42%",
    bottom: "89.06%",
  },
  dnamelist: {
    top: "11.13%",
    bottom: "85.35%",
  },
  enamelist: {
    top: "14.84%",
    bottom: "81.64%",
  },
  fnamelist: {
    top: "18.55%",
    bottom: "77.93%",
  },
  gnamelist: {
    top: "22.26%",
    bottom: "74.22%",
  },
  hnamelist: {
    top: "25.98%",
    bottom: "70.5%",
  },
  inamelist: {
    top: "29.69%",
    bottom: "66.79%",
  },
  jnamelist: {
    top: "33.4%",
    bottom: "63.08%",
  },
  knamelist: {
    top: "37.11%",
    bottom: "59.37%",
  },
  lnamelist: {
    top: "40.82%",
    bottom: "55.66%",
  },
  mnamelist: {
    top: "44.53%",
    bottom: "51.95%",
  },
  nnamelist: {
    top: "48.24%",
    bottom: "48.24%",
  },
  onamelist: {
    top: "51.95%",
    bottom: "44.53%",
  },
  pnamelist: {
    top: "55.66%",
    bottom: "40.82%",
  },
  qnamelist: {
    top: "59.37%",
    bottom: "37.11%",
  },
  rnamelist: {
    top: "63.08%",
    bottom: "33.4%",
  },
  snamelist: {
    top: "66.79%",
    bottom: "29.69%",
  },
  tnamelist: {
    top: "70.5%",
    bottom: "25.98%",
  },
  unamelist: {
    top: "74.22%",
    bottom: "22.26%",
  },
  vnamelist: {
    top: "77.93%",
    bottom: "18.55%",
  },
  wnamelist: {
    top: "81.64%",
    bottom: "14.84%",
  },
  xnamelist: {
    top: "85.35%",
    bottom: "11.13%",
  },
  ynamelist: {
    top: "89.06%",
    bottom: "7.42%",
  },
  znamelist: {
    top: "92.77%",
    bottom: "3.71%",
  },
  namelist: {
    top: "96.48%",
    bottom: "0%",
    height: "3.52%",
  },
  completelist: {
    height: "100%",
    top: "0%",
  },
  completelistParent: {
    flex: 1,
    height: 3665,
    width: "100%",
  },
});

export default AppointList;
