import React, { useState } from "react";
import { StyleSheet, View, Image, Text, Pressable } from "react-native";
import { Checkbox } from "react-native-paper";
//finish the  check boxes
const AttendenceList = () => {
  const [tchecked, setchecked] = useState(true);
  const [t1checked, set1checked] = useState(true);
  const [t2checked, set2checked] = useState(true);
  const [t3checked, set3checked] = useState(true);
  const [t4checked, set4checked] = useState(true);
  const [t5checked, set5checked] = useState(true);
  const [t6checked, set6checked] = useState(true);
  const [t7checked, set7checked] = useState(true);
  const [t8checked, set8checked] = useState(true);
  const [t9checked, set9checked] = useState(true);
  const [t10checked, set10checked] = useState(true);
  const [t11checked, set11checked] = useState(true);
  const [t12checked, set12checked] = useState(true);
  const [t13checked, set13checked] = useState(true);
  const [t14checked, set14checked] = useState(true);
  const [t15checked, set15checked] = useState(true);
  const [t16checked, set16checked] = useState(true);
  const [t17checked, set17checked] = useState(true);
  const [t18checked, set18checked] = useState(true);
  const [t19checked, set19checked] = useState(true);
  const [t20checked, set20checked] = useState(true);
  const [t21checked, set21checked] = useState(true);
  const [t22checked, set22checked] = useState(true);
  const [t23checked, set23checked] = useState(true);
  const [t24checked, set24checked] = useState(true);
  const [t25checked, set25checked] = useState(true);
  const [t26checked, set26checked] = useState(true);
  const [t27checked, set27checked] = useState(true);
  const [t28checked, set28checked] = useState(true);
  const [t29checked, set29checked] = useState(true);
  const [t30checked, set30checked] = useState(true);
  const [t31checked, set31checked] = useState(true);
  const [t32checked, set32checked] = useState(true);
  const [t33checked, set33checked] = useState(true);
  const [t34checked, set34checked] = useState(true);
  const [t35checked, set35checked] = useState(true);
  const [t36checked, set36checked] = useState(true);
  const [t37checked, set37checked] = useState(true);
  const [t38checked, set38checked] = useState(true);
  const [t39checked, set39checked] = useState(true);
  const [t40checked, set40checked] = useState(true);
  const [t41checked, set41checked] = useState(true);
  const [t42checked, set42checked] = useState(true);
  const [t43checked, set43checked] = useState(true);
  const [t44checked, set44checked] = useState(true);
  const [t45checked, set45checked] = useState(true);
  const [t46checked, set46checked] = useState(true);
  const [t47checked, set47checked] = useState(true);
  const [t48checked, set48checked] = useState(true);
  const [t49checked, set49checked] = useState(true);
  const [t50checked, set50checked] = useState(true);
  const [t51checked, set51checked] = useState(true);
  const [t52checked, set52checked] = useState(true);
  const [t53checked, set53checked] = useState(true);
  const [t54checked, set54checked] = useState(true);
  const [t55checked, set55checked] = useState(true);
  const [t56checked, set56checked] = useState(true);
  const [t57checked, set57checked] = useState(true);
  const [t58checked, set58checked] = useState(true);
  const [t59checked, set59checked] = useState(true);
  const [t60checked, set60checked] = useState(true);
  const [t61checked, set61checked] = useState(true);
  const [t62checked, set62checked] = useState(true);
  const [t63checked, set63checked] = useState(true);
  const [t64checked, set64checked] = useState(true);
  const [t65checked, set65checked] = useState(true);
  const [t66checked, set66checked] = useState(true);
  const [t67checked, set67checked] = useState(true);
  const [t68checked, set68checked] = useState(true);
  const [t69checked, set69checked] = useState(true);
  const [t70checked, set70checked] = useState(true);
  const [t71checked, set71checked] = useState(true);
  const [t72checked, set72checked] = useState(true);
  const [t73checked, set73checked] = useState(true);
  const [t74checked, set74checked] = useState(true);
  const [t75checked, set75checked] = useState(true);
  const [t76checked, set76checked] = useState(true);
  const [t77checked, set77checked] = useState(true);
  const [t78checked, set78checked] = useState(true);
  const [t79checked, set79checked] = useState(true);
  const [t80checked, set80checked] = useState(true);

  return (
    <View style={styles.completelistParent}>
      <View style={[styles.completelist, styles.completelistPosition]}>
        <View style={[styles.anamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>A name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>A name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>A name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>A</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              uncheckedColor="#8e8e93"
              color="blue"
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.bnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.bName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>B name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>B name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>B name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>B</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.cnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>C name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>C name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>C name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>C</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.dnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>D name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>D name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>D name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>D</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.enamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>E name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>E name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>E name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>E</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.fnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>F name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>F name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>F name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>F</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.gnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>G name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>G name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>G name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>G</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.hnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>H name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>H name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>H name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>H</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.inamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>I name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>I name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>I name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>I</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.jnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>J name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>J name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>J name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>J</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.knamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>K name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>K name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>K name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>K</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.lnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>L name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>L name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>L name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>L</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.mnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>M name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>M name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>M name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>M</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.nnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>N name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>N name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>N name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>N</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.onamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>O name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>O name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>O name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>O</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.pnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>P name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>P name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>P name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>P</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.qnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Q name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>Q name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>Q name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>Q</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.rnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>R name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>R name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>R name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>R</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.snamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>S name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>S name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>S name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>S</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.tnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>T name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>T name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>T name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>T</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.unamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>U name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>U name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>U name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>U</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.vnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>V name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>V name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>V name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>V</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.wnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>W name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>W name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>W name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>W</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.xnamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>X name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>X name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>X name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>X</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.ynamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Y name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>Y name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>Y name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>Y</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.znamelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}>Z name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>Z name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}>Z name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>Z</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
        </View>
        <View style={[styles.namelist, styles.namelistPosition]}>
          <View style={[styles.anamelistChild, styles.completelistPosition]} />
          <Image
            style={[styles.anamelistItem, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Image
            style={[styles.anamelistInner, styles.anamelistLayout]}
            resizeMode="cover"
            source={require("../assets/Line 40.png")}
          />
          <Pressable
            style={[styles.aName1Container, styles.name1ContainerPosition]}
            onPress={() => {}}
          >
            <Text style={[styles.aName1, styles.aFlexBox]}># name 1</Text>
          </Pressable>
          <Pressable style={styles.aName2Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}># name 2</Text>
          </Pressable>
          <Pressable style={styles.aName3Container} onPress={() => {}}>
            <Text style={[styles.aName1, styles.aFlexBox]}># name 3</Text>
          </Pressable>
          <Text style={[styles.a, styles.aFlexBox]}>#</Text>
          <View style={styles.checkbox1}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox2}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
          <View style={styles.checkbox3}>
            <Checkbox.Item
              status={tchecked ? "checked" : "unchecked"}
              onPress={() => {
                setchecked(!tchecked);
              }}
            ></Checkbox.Item>
          </View>
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
  attendancetitlePosition: {
    left: "0%",
    bottom: "0%",
    right: "0%",
    top: "0%",
    height: "100%",
    position: "absolute",
    width: "100%",
  },
  aFlexBox: {
    textAlign: "left",
    lineHeight: 24,
  },
  framePosition: {
    right: "-20%",
    left: "0%",
    position: "absolute",
  },
  checkbox: {
    color: "#8e8e93",
  },
  checkbox1: {
    top: 30,
    height: 25,
    width: "93%",
  },
  checkbox2: {
    top: 40,
    height: 25,
    width: "93%",
    Color: "#000",
  },
  checkbox3: {
    top: 50,
    height: 25,
    width: "93%",
  },
  anamelistChild: {
    height: "78.29%",
    top: "21.71%",
    backgroundColor: "rgba(30, 30, 30, 0.9)",
  },
  anamelistItem: {
    top: "45%",
    bottom: "56.59%",
  },
  anamelistInner: {
    top: "70%",
  },
  aName1: {
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
    top: "50%",
    left: "7.12%",
    position: "absolute",
  },
  aName3Container: {
    top: "75%",
    left: "7.12%",
    position: "absolute",
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
  wrapper: {
    bottom: "76.62%",
    top: "0%",
  },
  container: {
    top: "40.26%",
    bottom: "36.36%",
  },
  name1ContainerPosition: {
    top: "23.48%",
    position: "absolute",
  },
  frame: {
    top: "80.52%",
    bottom: "-3.9%",
  },
  vectorParent: {
    height: "59.69%",
    width: "3.82%",
    top: "27.13%",
    right: "14.25%",
    bottom: "13.18%",
    left: "81.93%",
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
    height: "100",
    top: "0%",
  },
  completelistParent: {
    flex: 1,
    height: 3665,
    width: "100%",
  },
});

export default AttendenceList;
